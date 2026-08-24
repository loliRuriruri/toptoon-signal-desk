param(
    [string]$ProjectName = 'toptoon-signal-desk',
    [string]$Branch = 'main'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$RuntimeDir = Join-Path $ProjectRoot '.runtime\auto-update'
$LogPath = Join-Path $RuntimeDir ("update-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$PublicDir = Join-Path $ProjectRoot 'dist-public'
$ProductionUrl = "https://$ProjectName.pages.dev/"
$mutex = [System.Threading.Mutex]::new($false, 'Local\ToptoonSignalDeskAutoUpdate')
$hasLock = $false

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string]$Label,
        [Parameter(Mandatory)] [scriptblock]$Command
    )

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Label"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed (exit code $LASTEXITCODE)"
    }
}

function Assert-PublicBuildHasNoLocalSecrets {
    $forbiddenNames = Get-ChildItem -LiteralPath $PublicDir -Recurse -Force -File |
        Where-Object { $_.Name -like '.env*' -or $_.Name -in @('secrets.json', 'credentials.json') }
    if ($forbiddenNames) {
        throw "Forbidden secret file found in public build: $($forbiddenNames.FullName -join ', ')"
    }

    $secretValues = @()
    $environmentPath = Join-Path $ProjectRoot '.env.local'
    if (Test-Path -LiteralPath $environmentPath) {
        foreach ($line in Get-Content -LiteralPath $environmentPath -Encoding UTF8) {
            if ($line -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+?)\s*$') {
                $name = $Matches[1]
                $value = $Matches[2].Trim().Trim('"').Trim("'")
                if ($name -notmatch '(_KEY|_SECRET|_TOKEN|PASSWORD|CREDENTIAL)$') { continue }
                if ($value.Length -ge 12) { $secretValues += $value }
            }
        }
    }

    if (-not $secretValues) { return }
    $publicTextFiles = Get-ChildItem -LiteralPath $PublicDir -Recurse -File |
        Where-Object { $_.Extension -in @('.html', '.js', '.css', '.json', '.txt') -or $_.Name -in @('_headers', '_redirects') }
    foreach ($file in $publicTextFiles) {
        $body = [System.IO.File]::ReadAllText($file.FullName)
        foreach ($secret in $secretValues) {
            if ($body.Contains($secret)) {
                throw "Public build secret scan failed: $($file.FullName)"
            }
        }
    }
}

try {
    $hasLock = $mutex.WaitOne(0)
    if (-not $hasLock) {
        Write-Host 'Another update is already running; skipping this run.'
        exit 0
    }

    Start-Transcript -LiteralPath $LogPath -Force | Out-Null
    Set-Location -LiteralPath $ProjectRoot

    Invoke-Checked 'Refresh four markets and public statistics' { & node (Join-Path $PSScriptRoot 'refresh-public-snapshot.mjs') }
    Invoke-Checked 'Run live cross-check' { & node (Join-Path $PSScriptRoot 'crosscheck.mjs') --live --write }
    Invoke-Checked 'Refresh official API signals' { & node (Join-Path $PSScriptRoot 'refresh-official-signals.mjs') }
    Invoke-Checked 'Validate data and application' { & node (Join-Path $PSScriptRoot 'validate.mjs') }
    Invoke-Checked 'Build public read-only bundle' { & node (Join-Path $PSScriptRoot 'build-public.mjs') }

    Assert-PublicBuildHasNoLocalSecrets
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Public build secret scan passed"

    Invoke-Checked 'Deploy Cloudflare Pages production' {
        & npx.cmd --yes wrangler@4.125.0 pages deploy $PublicDir --project-name $ProjectName --branch $Branch
    }

    $response = Invoke-WebRequest -Uri $ProductionUrl -UseBasicParsing -TimeoutSec 30
    if ($response.StatusCode -ne 200 -or -not $response.Content.Contains('TOPTOON CHAT TRACKER')) {
        throw "Production site verification failed: HTTP $($response.StatusCode)"
    }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Complete: $ProductionUrl"
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
