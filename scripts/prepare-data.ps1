$ErrorActionPreference = 'Stop'

$sourceRoot = 'C:\TEST\toptoon-tracker-extract-2026-08-24'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $projectRoot 'data'
$assetDir = Join-Path $projectRoot 'assets'

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

Copy-Item -LiteralPath (Join-Path $sourceRoot 'characters_combined.json') -Destination (Join-Path $dataDir 'characters.json') -Force
$jsonText = Get-Content (Join-Path $dataDir 'characters.json') -Raw -Encoding UTF8
$payload = $jsonText | ConvertFrom-Json
$slimRecords = @($payload.records | Select-Object locale, site, character_id, character_name, work_title, genre, one_line_intro, detailed_intro, custom_world_summary, hashtags, views, chats, local_image, safe_video_url, detail_url, source_id, created_at, start_at, published_at, source_updated_at)
$slimPayload = [ordered]@{
    generated_at = $payload.generated_at
    counts = $payload.counts
    records = $slimRecords
} | ConvertTo-Json -Depth 5 -Compress
$embeddedData = "window.TOPTOON_DATA=$slimPayload;document.documentElement.dataset.dataReady='true';`n"
[System.IO.File]::WriteAllText((Join-Path $dataDir 'characters.js'), $embeddedData, [System.Text.UTF8Encoding]::new($false))

@{
    'images' = 'kr'
    'images_jp' = 'jp'
    'images_global' = 'global'
}.GetEnumerator() | ForEach-Object {
    $destination = Join-Path $assetDir $_.Value
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Copy-Item -Path (Join-Path $sourceRoot ($_.Key + '\*')) -Destination $destination -Force
}

$counts = @{
    records = $payload.records.Count
    kr = @($payload.records | Where-Object site -eq 'KR').Count
    jp = @($payload.records | Where-Object site -eq 'JP').Count
    global = @($payload.records | Where-Object site -eq 'GLOBAL').Count
    assets = @(Get-ChildItem $assetDir -File -Recurse).Count
}
$counts | ConvertTo-Json
