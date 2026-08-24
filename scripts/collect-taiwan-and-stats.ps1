[CmdletBinding()]
param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$twApi = 'https://chat.toptoon.net/api/characters?limit=100'
$twSite = 'https://chat.toptoon.net'
$statsSite = 'https://toptoon-tracker.john6428.workers.dev'
$headers = @{
  'User-Agent' = 'Mozilla/5.0 (compatible; local-public-page-audit/1.0)'
  'Referer' = 'https://chat.toptoon.net/'
}

function Get-SafeFileName {
  param([Parameter(Mandatory)][string]$Name)
  $safe = $Name
  foreach ($char in [IO.Path]::GetInvalidFileNameChars()) {
    $safe = $safe.Replace([string]$char, '_')
  }
  return $safe.Trim()
}

function Write-Utf8NoBom {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Value)
  [System.IO.File]::WriteAllText($Path, $Value, [System.Text.UTF8Encoding]::new($false))
}

$dataDir = Join-Path $ProjectRoot 'data'
$twAssetDir = Join-Path $ProjectRoot 'assets\tw'
$charactersPath = Join-Path $dataDir 'characters.json'
New-Item -ItemType Directory -Force -Path $dataDir, $twAssetDir | Out-Null
if (-not (Test-Path -LiteralPath $charactersPath)) {
  throw "기존 통합 데이터가 없습니다: $charactersPath"
}

Write-Host '[1/4] Taiwan public character API'
$response = Invoke-RestMethod -Uri $twApi -TimeoutSec 45 -Headers $headers
if (-not $response.success) { throw 'Taiwan API returned success=false.' }
$twCharacters = @($response.data.data)
$twTotal = [int]$response.data.pagination.total
if ($twCharacters.Count -ne $twTotal) {
  throw "Taiwan API pagination mismatch: $($twCharacters.Count)/$twTotal"
}
Write-Utf8NoBom -Path (Join-Path $dataDir 'tw-api.json') -Value ($response | ConvertTo-Json -Depth 12)

Write-Host "[2/4] Taiwan public artwork ($twTotal files)"
$twRows = [System.Collections.Generic.List[object]]::new()
$index = 0
foreach ($character in $twCharacters) {
  $index++
  $id = [int64]$character.id
  $tags = @($character.hashtags | Sort-Object sortOrder | ForEach-Object hashtag)
  $workTitle = if ($tags.Count -gt 0) { [string]$tags[0] } else { $null }
  $imageUrl = [string]$character.thumbnail
  $safeVideoUrl = @([string]$character.safeVideoThumbnail, [string]$character.videoThumbnail) | Where-Object { $_ -match '\.mp4$' } | Select-Object -First 1
  $imageFile = $null
  if ($imageUrl) {
    $extension = [IO.Path]::GetExtension(([uri]$imageUrl).AbsolutePath).ToLowerInvariant()
    if ($extension -notin @('.png', '.jpg', '.jpeg', '.webp')) { $extension = '.img' }
    $imageFile = ('{0:D3}_{1}{2}' -f $id, (Get-SafeFileName -Name ([string]$character.name)), $extension)
    $destination = Join-Path $twAssetDir $imageFile
    if (-not (Test-Path -LiteralPath $destination) -or (Get-Item -LiteralPath $destination).Length -eq 0) {
      Invoke-WebRequest -UseBasicParsing -Uri $imageUrl -OutFile $destination -TimeoutSec 45 -Headers $headers
    }
  }
  $twRows.Add([pscustomobject][ordered]@{
    locale = 'zh-TW'
    site = 'TW'
    character_id = $id
    character_name = [string]$character.name
    work_title = $workTitle
    views = $character.viewCount
    chats = $character.chatCount
    thumbnail_url = $imageUrl
    safe_video_url = $safeVideoUrl
    local_image = if ($imageFile) { "images_tw/$imageFile" } else { $null }
    detail_url = "$twSite/detail/character/$id"
  })
  if (($index % 10) -eq 0 -or $index -eq $twTotal) { Write-Host "  $index/$twTotal" }
  Start-Sleep -Milliseconds 60
}

Write-Host '[3/4] Rebuild four-market bundles'
$existing = Get-Content -LiteralPath $charactersPath -Raw -Encoding UTF8 | ConvertFrom-Json
$baseRecords = @($existing.records | Where-Object site -ne 'TW')
$records = @($baseRecords) + @($twRows)
$uniqueIds = @($records.character_id | Sort-Object -Unique)
$counts = [ordered]@{
  kr = @($records | Where-Object site -eq 'KR').Count
  jp = @($records | Where-Object site -eq 'JP').Count
  global = @($records | Where-Object site -eq 'GLOBAL').Count
  tw = @($records | Where-Object site -eq 'TW').Count
  locale_records = $records.Count
  unique_character_ids = $uniqueIds.Count
}
$payload = [ordered]@{
  generated_at = (Get-Date).ToString('o')
  source_note = 'Public catalog snapshot; series/work title is inferred from the first sorted hashtag for JP, Global, and Taiwan.'
  counts = $counts
  records = $records
}
Write-Utf8NoBom -Path $charactersPath -Value ($payload | ConvertTo-Json -Depth 8)
$slimRecords = @($records | Select-Object locale, site, character_id, character_name, work_title, views, chats, local_image, safe_video_url, detail_url)
$slimPayload = [ordered]@{ generated_at=$payload.generated_at; counts=$counts; records=$slimRecords } | ConvertTo-Json -Depth 6 -Compress
Write-Utf8NoBom -Path (Join-Path $dataDir 'characters.js') -Value "window.TOPTOON_DATA=$slimPayload;document.documentElement.dataset.dataReady='true';`n"

Write-Host '[4/4] Snapshot original tracker public statistics'
$statsEndpoints = [ordered]@{
  revenue_nowcast = 'revenue-nowcast'
  revenue_by_character = 'revenue-by-character'
  coin_mix_ramp = 'coin-mix-ramp'
  completion_ceiling = 'completion-ceiling'
  growth_cannibalization = 'growth-cannibalization'
  monthly_index = 'monthly-index'
  totals_timeseries = 'totals-timeseries'
  daily_totals = 'daily-totals'
  daily_chat_totals = 'daily-chat-totals'
  characters = 'characters'
  site_comparison = 'site-comparison'
  site_traction = 'site-traction'
  site_revenue = 'site-revenue'
}
$stats = [ordered]@{
  captured_at = (Get-Date).ToString('o')
  source = $statsSite
  caveat = 'Public tracker snapshot. Revenue nowcasts and IR benchmarks are estimates or company-claim comparisons, not audited financial statements.'
}
foreach ($entry in $statsEndpoints.GetEnumerator()) {
  $stats[$entry.Key] = Invoke-RestMethod -Uri "$statsSite/api/$($entry.Value)" -TimeoutSec 45 -Headers @{
    'User-Agent' = $headers['User-Agent']
    'Referer' = "$statsSite/"
  }
}
$statsJson = $stats | ConvertTo-Json -Depth 14
Write-Utf8NoBom -Path (Join-Path $dataDir 'stats.json') -Value $statsJson
$statsCompact = $stats | ConvertTo-Json -Depth 14 -Compress
Write-Utf8NoBom -Path (Join-Path $dataDir 'stats.js') -Value "window.TOPTOON_STATS=$statsCompact;`n"

[pscustomobject]@{
  kr = $counts.kr
  jp = $counts.jp
  global = $counts.global
  tw = $counts.tw
  locale_records = $counts.locale_records
  unique_character_ids = $counts.unique_character_ids
  tw_assets = @(Get-ChildItem -LiteralPath $twAssetDir -File).Count
  stats_endpoints = $statsEndpoints.Count
} | ConvertTo-Json
