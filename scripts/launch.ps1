param(
    [int]$Port = 8788,
    [switch]$Refresh,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ServerScript = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'serve.mjs'))
$RuntimeDir = Join-Path $ProjectRoot '.runtime'
$Url = "http://127.0.0.1:$Port/"

if (-not $ServerScript.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw '서버 스크립트 경로가 프로젝트 밖을 가리킵니다.'
}

$Node = Get-Command node -ErrorAction Stop
New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

function Test-TrackerServer {
    try {
        $health = Invoke-RestMethod -Uri "${Url}api/health" -TimeoutSec 2
        return $health.ok -eq $true -and $health.app -eq 'toptoon-tracker-unified'
    }
    catch {
        return $false
    }
}

if ($Refresh) {
    & $Node.Source (Join-Path $PSScriptRoot 'refresh-public-snapshot.mjs')
    if ($LASTEXITCODE -ne 0) { throw '공개 스냅샷 갱신에 실패했습니다.' }
    & $Node.Source (Join-Path $PSScriptRoot 'crosscheck.mjs') --live --write
    if ($LASTEXITCODE -ne 0) { throw '교차검증 갱신에 실패했습니다.' }
    & $Node.Source (Join-Path $PSScriptRoot 'refresh-official-signals.mjs')
    if ($LASTEXITCODE -ne 0) { throw '공식 API 시그널 갱신에 실패했습니다.' }
}

if (-not (Test-TrackerServer)) {
    $stdout = Join-Path $RuntimeDir 'server.stdout.log'
    $stderr = Join-Path $RuntimeDir 'server.stderr.log'
    Start-Process -FilePath $Node.Source `
        -ArgumentList @($ServerScript, '--port', "$Port") `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr | Out-Null

    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        if (Test-TrackerServer) {
            $ready = $true
            break
        }
    }
    if (-not $ready) {
        throw "실행 시간이 초과됐습니다. 로그: $stderr"
    }
}

if (-not $NoBrowser) {
    Start-Process $Url
}
