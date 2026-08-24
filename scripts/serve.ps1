param(
    [int]$Port = 8788
)

$ErrorActionPreference = 'Stop'

Write-Host "Serving Toptoon Tracker Unified at http://127.0.0.1:$Port/"
node (Join-Path $PSScriptRoot 'serve.mjs') --port $Port
