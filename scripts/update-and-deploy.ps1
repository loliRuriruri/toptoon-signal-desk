param(
    [string]$ProjectName = 'toptoon-signal-desk',
    [string]$Branch = 'main'
)

# Enforce UTF-8 encoding across console and output streams
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$RuntimeDir = Join-Path $ProjectRoot '.runtime\auto-update'
$LogPath = Join-Path $RuntimeDir ("dispatch-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$ProductionUrl = "https://$ProjectName.pages.dev/"
$mutex = [System.Threading.Mutex]::new($false, 'Local\ToptoonSignalDeskAutoUpdate')
$hasLock = $false

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

function Get-GitWorkingTreeStatus {
    $statusOutput = & git status --porcelain 2>&1
    $userFiles = [System.Collections.Generic.List[string]]::new()
    $generatedFiles = [System.Collections.Generic.List[string]]::new()

    foreach ($line in ($statusOutput -split "`r?`n")) {
        $trimmed = $line.Trim()
        if (-not $trimmed) { continue }
        $match = [System.Text.RegularExpressions.Regex]::Match($trimmed, '^[A-Z?]{1,2}\s+(.*)$')
        if (-not $match.Success) { continue }
        $rawPath = $match.Groups[1].Value.Trim().Trim('"')
        if ($rawPath -match '->\s*(.+)$') {
            $rawPath = $Matches[1].Trim().Trim('"')
        }
        $normPath = $rawPath.Replace('\', '/')
        if ($normPath -like '.runtime/*' -or $normPath -eq '.env.local') { continue }
        if ($normPath -like 'data/*' -or $normPath -like 'assets/*') {
            $generatedFiles.Add($normPath)
        } else {
            $userFiles.Add($normPath)
        }
    }

    return [PSCustomObject]@{
        CanSync = ($userFiles.Count -eq 0)
        UserFiles = $userFiles.ToArray()
        GeneratedFiles = $generatedFiles.ToArray()
    }
}

function Map-StepToStage([string]$name) {
    if ($name -match 'Four-Market|Catalogs') { return '수집' }
    if ($name -match 'KIS|OpenDART|Signals') { return '수집' }
    if ($name -match 'Crosscheck') { return '교차검증' }
    if ($name -match 'Validate') { return '검증' }
    if ($name -match 'Nemotron|Diagnosis') { return 'AI진단' }
    if ($name -match 'Build') { return '빌드' }
    if ($name -match 'Cloudflare') { return 'Cloudflare 배포' }
    if ($name -match 'Commit|Push') { return 'GitHub 동기화' }
    return '준비'
}

try {
    $hasLock = $mutex.WaitOne(0)
    if (-not $hasLock) {
        Write-Host 'Another update is already running; skipping this run.'
        exit 0
    }

    Start-Transcript -LiteralPath $LogPath -Force | Out-Null
    Set-Location -LiteralPath $ProjectRoot

    # 1. Pre-flight Check: Ensure local working tree does not have uncommitted user source modifications
    $treeStatus = Get-GitWorkingTreeStatus
    if (-not $treeStatus.CanSync) {
        $userList = $treeStatus.UserFiles -join ', '
        Write-Host "[FAILED_COMMAND: git status --porcelain]"
        Write-Host "[LAST_STDERR: 로컬 사용자 소스 변경 감지: $userList]"
        throw "[로컬 최신화 단계 실패] 로컬 사용자 소스 변경이 존재하여 동기화를 중단했습니다: $userList"
    }

    # 2. Trigger remote GitHub Actions workflow (scheduled-refresh.yml) as single writer
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:GitHub 동기화] GitHub Actions 워크플로우(scheduled-refresh.yml) 시작 준비"
    $prevRunJson = & gh run list --workflow scheduled-refresh.yml -L 1 --json databaseId 2>&1
    $prevRunId = 0L
    try {
        $prevRuns = $prevRunJson | ConvertFrom-Json
        if ($prevRuns -and $prevRuns.Count -gt 0) {
            $prevRunId = [long]$prevRuns[0].databaseId
        }
    } catch {}

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:GitHub 동기화] gh workflow run scheduled-refresh.yml --ref $Branch"
    $dispatchOut = & gh workflow run scheduled-refresh.yml --ref $Branch 2>&1
    if ($LASTEXITCODE -ne 0) {
        $errText = ($dispatchOut -join "`n").Trim()
        Write-Host "[FAILED_COMMAND: gh workflow run scheduled-refresh.yml --ref $Branch]"
        Write-Host "[LAST_STDERR: $errText]"
        throw "[GitHub 동기화 단계 실패] workflow_dispatch 실행 실패: $errText"
    }

    # Wait for the dispatched run to register
    $runId = 0L
    $runUrl = ''
    $findStart = [DateTime]::UtcNow
    while ($runId -eq 0L -and ([DateTime]::UtcNow - $findStart).TotalSeconds -lt 40) {
        Start-Sleep -Milliseconds 1500
        $recentJson = & gh run list --workflow scheduled-refresh.yml -L 5 --json databaseId,status,conclusion,createdAt,event,url 2>&1
        try {
            $recentList = $recentJson | ConvertFrom-Json
            foreach ($r in $recentList) {
                if ([long]$r.databaseId -gt $prevRunId -and $r.event -eq 'workflow_dispatch') {
                    $runId = [long]$r.databaseId
                    $runUrl = $r.url
                    break
                }
            }
        } catch {}
    }

    if ($runId -eq 0L) {
        $recentJson = & gh run list --workflow scheduled-refresh.yml -L 2 --json databaseId,status,conclusion,url 2>&1
        try {
            $recentList = $recentJson | ConvertFrom-Json
            if ($recentList -and $recentList.Count -gt 0 -and $recentList[0].status -in @('queued', 'in_progress')) {
                $runId = [long]$recentList[0].databaseId
                $runUrl = $recentList[0].url
            }
        } catch {}
    }

    if ($runId -eq 0L) {
        Write-Host "[FAILED_COMMAND: gh run list --workflow scheduled-refresh.yml]"
        Write-Host "[LAST_STDERR: 신규 실행된 GitHub Actions run을 탐지하지 못했습니다]"
        throw "[GitHub 동기화 단계 실패] GitHub Actions 실행 인스턴스를 찾지 못했습니다 (timeout)"
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:GitHub 동기화] GitHub Actions Run #$runId 시작 ($runUrl)"

    # 3. Monitor remote workflow execution step by step
    $isCompleted = $false
    $conclusion = ''
    $lastLoggedStep = ''
    $trackStart = [DateTime]::UtcNow
    $maxMinutes = 15
    $view = $null

    while (-not $isCompleted -and ([DateTime]::UtcNow - $trackStart).TotalMinutes -lt $maxMinutes) {
        Start-Sleep -Seconds 2
        $viewRaw = & gh run view $runId --json status,conclusion,jobs 2>&1
        try {
            $view = $viewRaw | ConvertFrom-Json
            if ($view.status -eq 'completed') {
                $isCompleted = $true
                $conclusion = $view.conclusion
            }
            if ($view.jobs -and $view.jobs.Count -gt 0) {
                $steps = $view.jobs[0].steps
                $activeStep = $steps | Where-Object { $_.status -eq 'in_progress' } | Select-Object -First 1
                if (-not $activeStep) {
                    $activeStep = $steps | Where-Object { $_.status -eq 'completed' } | Select-Object -Last 1
                }
                if ($activeStep) {
                    $stepKey = "$($activeStep.name):$($activeStep.status)"
                    if ($stepKey -ne $lastLoggedStep) {
                        $lastLoggedStep = $stepKey
                        $stageName = Map-StepToStage $activeStep.name
                        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:$stageName] $($activeStep.name) ($($activeStep.status))"
                    }
                }
            }
        } catch {}
    }

    if (-not $isCompleted) {
        Write-Host "[FAILED_COMMAND: gh run view $runId]"
        Write-Host "[LAST_STDERR: 워크플로우 실행이 15분을 초과하여 타임아웃되었습니다]"
        throw "[GitHub 동기화 단계 실패] GitHub Actions 실행 타임아웃 (15분 초과)"
    }

    if ($conclusion -ne 'success') {
        $failedStep = $null
        if ($view -and $view.jobs -and $view.jobs.Count -gt 0) {
            $failedStep = $view.jobs[0].steps | Where-Object { $_.conclusion -eq 'failure' } | Select-Object -First 1
        }
        $failedStepName = if ($failedStep) { $failedStep.name } else { "원격 실행 단계" }
        $failedStage = Map-StepToStage $failedStepName

        $failedLog = & gh run view $runId --log-failed 2>&1 | Out-String
        $candidateLines = $failedLog -split "`r?`n" | Where-Object { $_ -match 'Validation failed|##\[error\]|error:|Error:|exit code' }
        $lastStderrText = if ($candidateLines) { ($candidateLines | Select-Object -Last 8) -join "`n" } else { ($failedLog -split "`r?`n" | Select-Object -Last 8) -join "`n" }

        Write-Host "[FAILED_COMMAND: gh run view $runId]"
        Write-Host "[LAST_STDERR: $lastStderrText]"
        throw "[$failedStage 단계 실패] $failedStepName 실패 (conclusion: $conclusion)"
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:GitHub 동기화] GitHub Actions 원격 파이프라인(배포 및 커밋) 성공 완료"

    # 4. Local fast-forward update: fetch origin/main and merge --ff-only
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:로컬 최신화] 원격 최신 변경사항 조회 (git fetch origin $Branch)"
    $fetchOut = & git fetch origin $Branch 2>&1
    if ($LASTEXITCODE -ne 0) {
        $errText = ($fetchOut -join "`n").Trim()
        Write-Host "[FAILED_COMMAND: git fetch origin $Branch]"
        Write-Host "[LAST_STDERR: $errText]"
        throw "[로컬 최신화 단계 실패] git fetch origin $Branch 실패: $errText"
    }

    # Verify no local user source modifications exist before merging
    $preMergeTree = Get-GitWorkingTreeStatus
    if (-not $preMergeTree.CanSync) {
        $userList = $preMergeTree.UserFiles -join ', '
        Write-Host "[FAILED_COMMAND: git merge --ff-only origin/$Branch]"
        Write-Host "[LAST_STDERR: 사용자 소스 변경 파일: $userList]"
        throw "[로컬 최신화 단계 실패] 로컬 사용자 소스 변경이 존재하여 merge를 중단했습니다: $userList"
    }

    # Safely clean generated data/assets leftover changes to ensure clean fast-forward
    if ($preMergeTree.GeneratedFiles.Count -gt 0) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:로컬 최신화] 로컬 생성 잔여 data/assets 정리 ($($preMergeTree.GeneratedFiles.Count)개 파일)"
        & git restore --staged data/ assets/ 2>&1 | Out-Null
        & git restore data/ assets/ 2>&1 | Out-Null
        & git clean -fd data/ assets/ 2>&1 | Out-Null
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:로컬 최신화] git merge --ff-only origin/$Branch"
    $mergeOut = & git merge --ff-only "origin/$Branch" 2>&1
    if ($LASTEXITCODE -ne 0) {
        $errText = ($mergeOut -join "`n").Trim()
        Write-Host "[FAILED_COMMAND: git merge --ff-only origin/$Branch]"
        Write-Host "[LAST_STDERR: $errText]"
        throw "[로컬 최신화 단계 실패] origin/$Branch 브랜치를 fast-forward로 병합할 수 없습니다: $errText"
    }

    $finalHead = (& git rev-parse --short HEAD).Trim()
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [STAGE:완료] 로컬 최신화 완료 (HEAD: $finalHead)"
}
catch {
    Write-Error $_
    exit 1
}
finally {
    try { Stop-Transcript | Out-Null } catch {}
    if ($hasLock) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
