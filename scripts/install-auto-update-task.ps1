param(
    [ValidateRange(1, 24)] [int]$IntervalHours = 3,
    [switch]$RunNow
)

$ErrorActionPreference = 'Stop'
$TaskName = 'TOPTOON Signal Desk Auto Update'
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$UpdateScript = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'update-and-deploy.ps1'))

if (-not $UpdateScript.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'The update script resolves outside the project directory.'
}

$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$UpdateScript`""
$action = New-ScheduledTaskAction -Execute $PowerShell -Argument $arguments -WorkingDirectory $ProjectRoot
$startAt = (Get-Date).AddHours($IntervalHours)
$periodic = New-ScheduledTaskTrigger -Once -At $startAt -RepetitionInterval (New-TimeSpan -Hours $IntervalHours)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -RunOnlyIfNetworkAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($periodic, $logon) `
    -Settings $settings `
    -Principal $principal `
    -Description "Refresh, validate, safely build, and deploy TOPTOON public data every $IntervalHours hours." `
    -Force | Out-Null

if ($RunNow) { Start-ScheduledTask -TaskName $TaskName }

$task = Get-ScheduledTask -TaskName $TaskName
[pscustomobject]@{
    TaskName = $task.TaskName
    State = $task.State
    IntervalHours = $IntervalHours
    FirstScheduledRun = $startAt
    RunNow = [bool]$RunNow
}
