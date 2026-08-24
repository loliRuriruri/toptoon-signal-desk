import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const data = readJson("data/characters.json");
const stats = readJson("data/stats.json");
const validation = readJson("data/validation.json");
const officialSignals = readJson("data/official-signals.json");
const characterActivity = readJson("data/character-activity.json");
const embeddedData = readFileSync(path.join(root, "data", "characters.js"), "utf8");
const embeddedStats = readFileSync(path.join(root, "data", "stats.js"), "utf8");
const embeddedValidation = readFileSync(path.join(root, "data", "validation.js"), "utf8");
const embeddedOfficialSignals = readFileSync(path.join(root, "data", "official-signals.js"), "utf8");
const embeddedCharacterActivity = readFileSync(path.join(root, "data", "character-activity.js"), "utf8");
const records = data.records || [];
const bySite = new Map();
for (const record of records) {
  bySite.set(record.site, (bySite.get(record.site) || 0) + 1);
}

assert(data.counts?.kr === 87, "expected 87 KR records");
assert(data.counts?.jp === 77, "expected 77 JP records");
assert(data.counts?.global === 84, "expected 84 Global records");
assert(data.counts?.tw === 81, "expected 81 Taiwan records");
assert(records.length === 329, "expected 329 locale records");
assert(/^window\.TOPTOON_DATA\s*=\s*\{/.test(embeddedData), "embedded dataset should be available without fetch");
assert(/^window\.TOPTOON_STATS\s*=\s*\{/.test(embeddedStats), "embedded statistics should be available without fetch");
assert(/^window\.TOPTOON_VALIDATION\s*=\s*\{/.test(embeddedValidation), "embedded validation should be available without fetch");
assert(/^window\.TOPTOON_OFFICIAL_SIGNALS\s*=\s*\{/.test(embeddedOfficialSignals), "embedded official signal state should be available without fetch");
assert(/^window\.TOPTOON_CHARACTER_ACTIVITY\s*=\s*\{/.test(embeddedCharacterActivity), "embedded four-market activity should be available without fetch");
assert(new Set(records.map((record) => record.character_id)).size === 104, "expected 104 unique character IDs");
assert(bySite.get("KR") === 87, "KR record count mismatch");
assert(bySite.get("JP") === 77, "JP record count mismatch");
assert(bySite.get("GLOBAL") === 84, "Global record count mismatch");
assert(bySite.get("TW") === 81, "Taiwan record count mismatch");
assert(records.every((record) => /^https:\/\/showcase\.chat\.(?:toptoon\.(?:com|jp|net)|global\.toptoon\.com)\/character\/\d+\/video-thumbnail\/[a-z0-9-]+\.mp4$/i.test(record.safe_video_url || "")), "every locale record should have a validated official motion URL");
assert((officialSignals.providers?.kis?.peers || []).filter((peer) => peer.status === "ok").length >= 4, "KIS peer valuation screen is incomplete");
assert(officialSignals.providers?.kis?.market_alert?.trading_halt?.reference_close > 0, "KRX halt reference close is missing");
assert(officialSignals.providers?.kis?.market_alert?.trading_halt?.trigger_price_raw > 0, "KRX halt trigger calculation is missing");
assert(officialSignals.providers?.kis?.market_alert?.warning_release?.fifteen_day_reference_close > 0, "KRX warning release reference is missing");

[
  "revenue_nowcast",
  "revenue_by_character",
  "completion_ceiling",
  "growth_cannibalization",
  "totals_timeseries",
  "site_comparison",
  "site_traction",
  "site_revenue"
].forEach((key) => assert(stats[key], `missing statistics payload: ${key}`));
assert(stats.totals_timeseries.rows?.length >= 5, "statistics time series is unexpectedly short");
assert(stats.characters?.characters?.length === 87, "expected 87 KR character activity rows");
assert(stats.characters.characters.every((row) => Number.isFinite(Number(row.delta)) && Number.isFinite(Number(row.chat_delta)) && /^\d{4}-\d{2}-\d{2}$/.test(row.last_seen)), "character activity deltas or collection dates are invalid");
const activityExpectedCounts = { kr: 87, jp: 77, global: 84, tw: 81 };
for (const [market, expected] of Object.entries(activityExpectedCounts)) {
  const marketActivity = characterActivity.markets?.[market];
  const rows = marketActivity?.rows || [];
  assert(rows.length === expected, `${market} activity row count mismatch`);
  assert(new Set(rows.map((row) => row.character_id)).size === expected, `${market} activity character IDs are not unique`);
  assert(rows.every((row) => row.delta == null || Number.isFinite(Number(row.delta))), `${market} view deltas are invalid`);
  assert(rows.every((row) => row.chat_delta == null || Number.isFinite(Number(row.chat_delta))), `${market} chat deltas are invalid`);
  assert(rows.every((row) => /^\d{4}-\d{2}-\d{2}T/.test(row.last_seen || "")), `${market} activity timestamps are invalid`);
  assert(marketActivity.comparable_count + marketActivity.new_count === expected, `${market} activity comparison coverage mismatch`);
}
assert(validation.overall_status === "share-with-caveats", "validation posture should remain share-with-caveats until AI chat revenue is disclosed");
assert(validation.summary?.block === 0, "validation contains blocking failures");
assert(validation.summary?.pass >= 10, "validation pass coverage is unexpectedly low");
assert(validation.checks?.some((check) => check.id === "ai-chat-revenue-tieout" && check.status === "warn"), "AI chat revenue disclosure gap must remain visible");
assert(validation.investor?.filing_snapshot?.source_id === "SRC-FILING-H1-2026", "official filing evidence is missing");

const seenPerSite = new Set();
for (const record of records) {
  const key = `${record.site}:${record.character_id}`;
  assert(!seenPerSite.has(key), `duplicate site character ID ${key}`);
  seenPerSite.add(key);

  const market = record.site === "KR" ? "kr" : record.site === "JP" ? "jp" : record.site === "TW" ? "tw" : "global";
  const filename = String(record.local_image || "").split("/").pop();
  assert(filename, `missing local image reference for ${key}`);
  assert(existsSync(path.join(root, "assets", market, filename)), `missing asset for ${key}: ${filename}`);
  assert(/^https:\/\/chat\.(?:toptoon\.(?:com|jp|net)|global\.toptoon\.com)\//.test(record.detail_url), `unexpected detail URL for ${key}`);
}

const globalMissingWorks = records.filter((record) => record.site === "GLOBAL" && !record.work_title).length;
assert(globalMissingWorks === 1, "expected one Global record with missing work title");
const twMissingWorks = records.filter((record) => record.site === "TW" && !record.work_title).length;
assert(twMissingWorks === 1, "expected one Taiwan record with missing work title");

const html = readFileSync(path.join(root, "index.html"), "utf8");
const css = readFileSync(path.join(root, "styles.css"), "utf8");
const js = readFileSync(path.join(root, "app.js"), "utf8");
assert(html.includes("data/characters.js"), "embedded dataset script must be referenced");
assert(html.includes("data/character-activity.js"), "embedded activity script must be referenced");

[
  "data-view=\"stats\"",
  "data-view=\"validation\"",
  "data-view=\"characters\"",
  "data-view=\"settings\"",
  "data-market=\"all\"",
  "data-market=\"kr\"",
  "data-market=\"jp\"",
  "data-market=\"global\"",
  "data-market=\"tw\"",
  "character-dialog",
  "validation-dashboard",
  "settings-view",
  "TOPTOON SIGNAL DESK",
  "필터 초기화",
  "data/stats.js",
  "data/validation.js"
  ,"data/official-signals.js"
].forEach((marker) => assert(html.includes(marker), `missing HTML marker: ${marker}`));

[
  "--bg: #070a0f",
  "--panel: #0e131c",
  "--accent: #62a8ff",
  "@media (max-width: 720px)",
  "overflow-x: hidden",
  ".card-list",
  ".stats-dashboard",
  ".validation-dashboard",
  ".validation-table",
  ".settings-provider-grid",
  ".chart-grid",
  ".character-rank-grid",
  ".journey-steps",
  ".snapshot-flow",
  ".period-comparison-card",
  ".chart-readout",
  ".column-chart",
  ".composition-track",
  ".dialog-image-frame",
  ".character-motion-shell",
  ".decision-path",
  ".peer-layout",
  "object-fit: contain"
].forEach((marker) => assert(css.includes(marker), `missing CSS marker: ${marker}`));

[
  "buildGroups",
  "renderStatsDashboard",
  "renderValidationDashboard",
  "renderSourceLedger",
  "renderIntegrationStatus",
  "renderSettingsView",
  "saveApiSettings",
  "runAiAnalysis",
  "renderMarketComposition",
  "renderColumnChart",
  "renderCharacterLeaderboard",
  "leaderboardRanking",
  "data-leaderboard-market",
  "시장 내 대화 비중",
  "renderCharacterMotion",
  "renderPeerComparison",
  "renderMarketAlertGuide",
  "renderNewCharacterSupply",
  "최고 반응월",
  "최다 출시월",
  "renderSnapshotJourney",
  "renderPeriodComparison",
  "renderGlobalPanel",
  "renderCatalogSummary",
  "characterActivity",
  "activitySummaryForMarket",
  "공개 API 수집 간 대비",
  "최근 조회 증가",
  "최근 대화 증가",
  "URLSearchParams",
  "showModal",
  "noopener noreferrer",
  "작품 정보 없음",
  "assets/${market}/${filename}"
].forEach((marker) => assert(js.includes(marker), `missing JS marker: ${marker}`));

const syntax = spawnSync(process.execPath, ["--check", "app.js"], {
  cwd: root,
  encoding: "utf8"
});
assert(syntax.status === 0, `node --check app.js failed: ${syntax.stderr || syntax.stdout}`);

const serverSyntax = spawnSync(process.execPath, ["--check", "scripts/serve.mjs"], {
  cwd: root,
  encoding: "utf8"
});
assert(serverSyntax.status === 0, `node --check scripts/serve.mjs failed: ${serverSyntax.stderr || serverSyntax.stdout}`);
assert(existsSync(path.join(root, "TOPTOON-Tracker.cmd")), "double-click launcher is missing");
assert(existsSync(path.join(root, "scripts", "launch.ps1")), "PowerShell launcher is missing");
assert(existsSync(path.join(root, ".env.example")), "safe environment template is missing");
const serverSource = readFileSync(path.join(root, "scripts", "serve.mjs"), "utf8");
assert(serverSource.includes("/api/integrations/status"), "server-only integration status endpoint is missing");
assert(serverSource.includes("/api/settings"), "server-only settings endpoint is missing");
assert(serverSource.includes("/api/analysis/openrouter"), "OpenRouter analysis endpoint is missing");
assert(serverSource.includes("/media-proxy"), "local motion proxy endpoint is missing");
assert(serverSource.includes(".env.local"), "local environment loader is missing");

for (const script of ["scripts/refresh-public-snapshot.mjs", "scripts/crosscheck.mjs", "scripts/refresh-official-signals.mjs"]) {
  const check = spawnSync(process.execPath, ["--check", script], { cwd: root, encoding: "utf8" });
  assert(check.status === 0, `node --check ${script} failed: ${check.stderr || check.stdout}`);
}
const workerSyntax = spawnSync(process.execPath, ["--check", "public-worker.js"], { cwd: root, encoding: "utf8" });
assert(workerSyntax.status === 0, `node --check public-worker.js failed: ${workerSyntax.stderr || workerSyntax.stdout}`);
const workerSource = readFileSync(path.join(root, "public-worker.js"), "utf8");
assert(workerSource.includes("env.ASSETS.fetch(request)"), "public worker must forward static assets");
assert(workerSource.includes("video-thumbnail"), "public worker motion allowlist is missing");

if (failures.length) {
  console.error("Validation failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("Validation passed: four-market data/assets, live cross-check snapshot, investor evidence, DOM/style markers, and JavaScript syntax are OK.");
