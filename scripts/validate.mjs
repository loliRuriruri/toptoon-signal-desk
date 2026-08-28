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
const officialPromotions = readJson("data/official-promotions.json");
const officialHomeBanners = readJson("data/official-home-banners.json");
const aiDiagnosis = readJson("data/ai-diagnosis.json");
const characterActivity = readJson("data/character-activity.json");
const embeddedData = readFileSync(path.join(root, "data", "characters.js"), "utf8");
const embeddedStats = readFileSync(path.join(root, "data", "stats.js"), "utf8");
const embeddedValidation = readFileSync(path.join(root, "data", "validation.js"), "utf8");
const embeddedOfficialSignals = readFileSync(path.join(root, "data", "official-signals.js"), "utf8");
const embeddedOfficialPromotions = readFileSync(path.join(root, "data", "official-promotions.js"), "utf8");
const embeddedOfficialHomeBanners = readFileSync(path.join(root, "data", "official-home-banners.js"), "utf8");
const embeddedAiDiagnosis = readFileSync(path.join(root, "data", "ai-diagnosis.js"), "utf8");
const embeddedCharacterActivity = readFileSync(path.join(root, "data", "character-activity.js"), "utf8");
const records = data.records || [];
const bySite = new Map();
for (const record of records) {
  bySite.set(record.site, (bySite.get(record.site) || 0) + 1);
}

assert(Number(data.counts?.kr || 0) >= 80, "expected at least 80 KR records");
assert(Number(data.counts?.jp || 0) >= 70, "expected at least 70 JP records");
assert(Number(data.counts?.global || 0) >= 80, "expected at least 80 Global records");
assert(Number(data.counts?.tw || 0) >= 75, "expected at least 75 Taiwan records");
assert(records.length >= 300, "expected at least 300 locale records");
assert(/^window\.TOPTOON_DATA\s*=\s*\{/.test(embeddedData), "embedded dataset should be available without fetch");
assert(/^window\.TOPTOON_STATS\s*=\s*\{/.test(embeddedStats), "embedded statistics should be available without fetch");
assert(/^window\.TOPTOON_VALIDATION\s*=\s*\{/.test(embeddedValidation), "embedded validation should be available without fetch");
assert(/^window\.TOPTOON_OFFICIAL_SIGNALS\s*=\s*\{/.test(embeddedOfficialSignals), "embedded official signal state should be available without fetch");
assert(/^window\.TOPTOON_OFFICIAL_PROMOTIONS\s*=\s*\{/.test(embeddedOfficialPromotions), "embedded official promotion state should be available without fetch");
assert(/^window\.TOPTOON_OFFICIAL_HOME_BANNERS\s*=\s*\{/.test(embeddedOfficialHomeBanners), "embedded official home banner state should be available without fetch");
assert(/^window\.TOPTOON_AI_DIAGNOSIS\s*=\s*\{/.test(embeddedAiDiagnosis), "embedded scheduled AI diagnosis should be available without fetch");
assert(/^window\.TOPTOON_CHARACTER_ACTIVITY\s*=\s*\{/.test(embeddedCharacterActivity), "embedded four-market activity should be available without fetch");
assert(new Set(records.map((record) => `${record.site}:${record.character_id}`)).size === records.length, "duplicate character ID per market detected");
assert(bySite.get("KR") === data.counts?.kr, "KR record count mismatch");
assert(bySite.get("JP") === data.counts?.jp, "JP record count mismatch");
assert(bySite.get("GLOBAL") === data.counts?.global, "Global record count mismatch");
assert(bySite.get("TW") === data.counts?.tw, "Taiwan record count mismatch");
assert(records.every((record) => /^https:\/\/showcase\.chat\.(?:toptoon\.(?:com|jp|net)|global\.toptoon\.com)\/character\/\d+\/video-thumbnail\/[a-z0-9-]+\.mp4$/i.test(record.safe_video_url || "")), "every locale record should have a validated official motion URL");
assert(records.every((record) => typeof record.genre === "string" && record.genre.trim()), "every locale record should retain the official genre field");
assert(records.every((record) => record.one_line_intro == null || typeof record.one_line_intro === "string"), "character one-line introductions must remain strings when present");
assert(records.every((record) => record.detailed_intro == null || typeof record.detailed_intro === "string"), "character detailed introductions must remain strings when present");
assert(records.every((record) => record.custom_world_summary == null || typeof record.custom_world_summary === "string"), "character world summaries must remain strings when present");
assert(records.every((record) => Array.isArray(record.hashtags)), "character hashtag metadata must remain arrays");
assert(records.some((record) => record.one_line_intro || record.detailed_intro || record.custom_world_summary), "character introduction metadata is missing from the public snapshot");
assert(records.every((record) => /^\d{4}-\d{2}-\d{2}T/.test(record.created_at || "")), "every locale record should retain the official creation timestamp");
assert(records.every((record) => /^\d{4}-\d{2}-\d{2}T/.test(record.published_at || "")), "every locale record should have a public-start timestamp or documented creation fallback");
assert((officialSignals.providers?.kis?.peers || []).filter((peer) => ["ok", "cached"].includes(peer.status)).length >= 1, "KIS peer valuation screen is incomplete");
assert(officialSignals.providers?.kis?.market_alert?.trading_halt?.reference_close > 0, "KRX halt reference close is missing");
assert(officialSignals.providers?.kis?.market_alert?.trading_halt?.trigger_price_raw > 0, "KRX halt trigger calculation is missing");
const halt = officialSignals.providers?.kis?.market_alert?.trading_halt || {};
const haltJudgmentDate = String(halt.judgment_date || "").replaceAll("-", "");
const haltJudgmentClose = (officialSignals.providers?.kis?.price_history || []).find((row) => row.date === haltJudgmentDate)?.close;
assert(haltJudgmentClose != null, "KRX halt judgment-date close is missing");
assert(Number(halt.observed_close) === Number(haltJudgmentClose), "KRX halt must use the judgment-date close, not the latest quote");
assert(halt.condition_met === (Number(haltJudgmentClose) >= Number(halt.trigger_price_raw)), "KRX halt condition does not match judgment-date close");
assert(officialSignals.providers?.kis?.market_alert?.warning_release?.fifteen_day_reference_close > 0, "KRX warning release reference is missing");
assert(["ok", "not-configured"].includes(aiDiagnosis.status), "scheduled AI diagnosis status is invalid");
if (aiDiagnosis.status === "ok") {
  assert(/^\d{4}-\d{2}-\d{2}T/.test(aiDiagnosis.generated_at || ""), "scheduled AI diagnosis timestamp is missing");
  assert(typeof aiDiagnosis.analysis === "string" && aiDiagnosis.analysis.length >= 100, "scheduled AI diagnosis output is unexpectedly short");
  assert(typeof aiDiagnosis.input_hash === "string" && aiDiagnosis.input_hash.length === 64, "scheduled AI diagnosis input hash is invalid");
}
for (const [providerId, provider] of Object.entries(officialSignals.providers || {})) {
  if (["ok", "cached"].includes(provider.status)) assert(/^\d{4}-\d{2}-\d{2}T/.test(provider.observed_at || ""), `${providerId} provider observation timestamp is missing`);
  assert(/^\d{4}-\d{2}-\d{2}T/.test(provider.attempted_at || ""), `${providerId} provider attempt timestamp is missing`);
}
assert(officialPromotions.source_tier === "A", "official promotions should retain first-party source tier");
assert(/^\d{4}-\d{2}-\d{2}T/.test(officialPromotions.generated_at || ""), "official promotion observation timestamp is missing");
for (const market of ["kr", "jp", "global", "tw"]) {
  const observation = officialPromotions.markets?.[market];
  assert(observation, `${market} official promotion observation is missing`);
  assert(["verified", "partial", "none", "unavailable"].includes(observation?.status), `${market} official promotion status is invalid`);
  assert(/^https:\/\/chat\.(?:toptoon\.(?:com|jp|net)|global\.toptoon\.com)\/$/.test(observation?.homepage_url || ""), `${market} official promotion homepage URL is invalid`);
  for (const item of observation?.items || []) {
    assert(item.api_badge === "price_promotion", `${market} promotion item lacks the official API badge`);
    assert(["api-and-homepage", "api-badge-only"].includes(item.verification), `${market} promotion verification state is invalid`);
    if (item.verification === "api-and-homepage") assert(typeof item.headline === "string" && item.headline.includes(item.character_name), `${market} verified promotion headline does not match its character`);
  }
}
assert(officialHomeBanners.source_tier === "A", "official home banners should retain first-party source tier");
assert(/^\d{4}-\d{2}-\d{2}T/.test(officialHomeBanners.generated_at || ""), "official home banner observation timestamp is missing");
for (const market of ["kr", "jp", "global", "tw"]) {
  const observation = officialHomeBanners.markets?.[market];
  assert(observation, `${market} official home banner observation is missing`);
  assert(["ok", "partial", "empty", "unavailable"].includes(observation?.status), `${market} official home banner status is invalid`);
  assert(/^https:\/\/chat\.(?:toptoon\.(?:com|jp|net)|global\.toptoon\.com)\/$/.test(observation?.homepage_url || ""), `${market} official home banner homepage URL is invalid`);
  for (const item of observation?.items || []) {
    assert(/^assets\/home-banners\/(?:kr|jp|global|tw)\/.+\.(?:webp|png|jpe?g)$/i.test(item.image_url || ""), `${market} home banner image must use the cached public asset`);
    assert(existsSync(path.join(root, item.image_url)), `${market} home banner cached asset is missing: ${item.image_url}`);
    assert(/^https:\/\/showcase\.chat\.(?:toptoon\.(?:com|jp|net)|global\.toptoon\.com)\/banner\/main-top\//.test(item.source_image_url || ""), `${market} home banner source image must come from the official showcase host`);
    assert(item.source_url === observation.homepage_url, `${market} home banner source URL must match the official homepage`);
    assert(Array.isArray(item.badges), `${market} home banner badges must remain an array`);
    assert(item.title || item.info_text, `${market} home banner must retain an observed title or info text`);
    if (item.detail_url) assert(/^https:\/\/chat\.(?:toptoon\.(?:com|jp|net)|global\.toptoon\.com)\//.test(item.detail_url), `${market} home banner detail URL is invalid`);
  }
}

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
assert(stats.characters?.characters?.length >= 80, "expected KR character activity rows");
assert(stats.characters.characters.every((row) => Number.isFinite(Number(row.delta)) && Number.isFinite(Number(row.chat_delta)) && /^\d{4}-\d{2}-\d{2}$/.test(row.last_seen)), "character activity deltas or collection dates are invalid");
const activityExpectedCounts = { kr: data.counts?.kr, jp: data.counts?.jp, global: data.counts?.global, tw: data.counts?.tw };
for (const [market, expected] of Object.entries(activityExpectedCounts)) {
  const marketActivity = characterActivity.markets?.[market];
  const rows = marketActivity?.rows || [];
  assert(rows.length === expected, `${market} activity row count mismatch: expected ${expected}, got ${rows.length}`);
  assert(new Set(rows.map((row) => row.character_id)).size === expected, `${market} activity character IDs are not unique`);
  assert(rows.every((row) => row.delta == null || Number.isFinite(Number(row.delta))), `${market} view deltas are invalid`);
  assert(rows.every((row) => row.chat_delta == null || Number.isFinite(Number(row.chat_delta))), `${market} chat deltas are invalid`);
  assert(rows.every((row) => /^\d{4}-\d{2}-\d{2}T/.test(row.last_seen || "")), `${market} activity timestamps are invalid`);
  assert(marketActivity.comparable_count + marketActivity.new_count === expected, `${market} activity comparison coverage mismatch`);
}
const activityHistory = characterActivity.history || [];
assert(activityHistory.length >= 2, "four-market activity history needs at least two snapshots");
assert(new Set(activityHistory.map((row) => row.captured_at)).size === activityHistory.length, "activity history timestamps must be unique");
assert(activityHistory.every((row, index) => index === 0 || new Date(row.captured_at) > new Date(activityHistory[index - 1].captured_at)), "activity history must be ordered oldest to newest");
for (const snapshot of activityHistory) {
  for (const market of Object.keys(activityExpectedCounts)) {
    const values = snapshot.markets?.[market];
    assert(values && [values.characters, values.views, values.chats].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0), `${market} activity history aggregate is invalid`);
  }
}
const characterHistory = characterActivity.character_history || [];
assert(characterHistory.length >= 1, "character hourly history needs at least one comparable interval");
assert(new Set(characterHistory.map((row) => row.captured_at)).size === characterHistory.length, "character hourly history timestamps must be unique");
assert(characterHistory.every((row, index) => index === 0 || new Date(row.captured_at) > new Date(characterHistory[index - 1].captured_at)), "character hourly history must be ordered oldest to newest");
for (const interval of characterHistory) {
  assert(Number(interval.interval_seconds) > 0, "character hourly interval duration must be positive");
  assert(new Date(interval.captured_at) > new Date(interval.baseline_at), "character hourly interval timestamps are invalid");
  for (const market of Object.keys(activityExpectedCounts)) {
    const values = interval.markets?.[market];
    assert(values && typeof values === "object" && !Array.isArray(values), `${market} character hourly interval is missing`);
    assert(Object.values(values).every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((value) => Number.isFinite(Number(value)))), `${market} character hourly deltas are invalid`);
  }
}
assert(validation.overall_status === "share-with-caveats", "validation posture should remain share-with-caveats until AI chat revenue is disclosed");
assert(validation.summary?.block === 0, "validation contains blocking failures");
assert(validation.checks?.length >= 18, "validation check coverage is unexpectedly low");
for (const requiredPassId of ["revenue-nowcast-formula", "all-market-revenue-scope", "display-semantic-guard", "krx-halt-date-tieout", "cached-provider-freshness"]) {
  assert(validation.checks?.some((check) => check.id === requiredPassId && check.status === "pass"), `required integrity check did not pass: ${requiredPassId}`);
}
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
[
  "목표 50만 중 38만 관측",
  "실측 진척률",
  "안정 유지 (+0.1%)",
  "3일 외삽 · C등급",
  "누적 대화수 184만회",
  "약 70%가 월 5만원",
  "약 1,373억원",
  "상위 3개 캐릭터 탐색 조회수 집중",
  "진성 대화 세션 집중",
  "전체 조회의 82%",
  "매출 산출의 핵심 본진",
  "일간 조회수 +110만 회"
].forEach((claim) => assert(!`${js}\n${html}`.includes(claim), `unsupported or stale numeric display claim: ${claim}`));
assert(/id="ai-analysis-output" hidden><\/pre>/.test(html), "preset analysis output should be generated from the current snapshot");
assert(js.includes("siteRevenue.grand_total_mid"), "headline recent run-rate must use the all-market total");
assert(js.includes("haltJudgmentClose"), "KRX halt UI must use the judgment-date close");
assert(js.includes("characterHourlyMetrics"), "character detail must calculate normalized hourly metrics");
assert(js.includes("characterPeriodMetrics"), "character detail must expose a source-aware observed/24h period metric");
assert(js.includes("시간당 평균 조회") && js.includes("시간당 평균 대화"), "character detail hourly metric labels are missing");
assert(!js.includes("최근 갱신 조회</span>") && !js.includes("최근 갱신 대화</span>"), "character detail must not display raw collection-interval cards");
assert(js.includes("renderHoverPreviewMedia") && js.includes("data-hover-preview"), "official media hover preview wiring is missing");
assert(/banner\\\/main-top/.test(js), "official home banner motion preview path is missing");
assert(html.includes("data/characters.js"), "embedded dataset script must be referenced");
assert(html.includes("data/character-activity.js"), "embedded activity script must be referenced");
assert(html.includes("data/official-promotions.js"), "embedded official promotion script must be referenced");
assert(html.includes("data/official-home-banners.js"), "embedded official home banner script must be referenced");

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
  "data-stats-market=\"all\"",
  "data-stats-market=\"tw\"",
  "character-dialog",
  "validation-dashboard",
  "settings-view",
  "TOPTOON SIGNAL DESK",
  "필터 초기화",
  "data/stats.js",
  "data/validation.js"
  ,"data/official-signals.js"
  ,"data/official-promotions.js"
  ,"data/official-home-banners.js"
  ,"data/ai-diagnosis.js"
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
  ".business-scope-bar",
  ".market-kpi-grid",
  ".media-hover-preview",
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
  "data-rank-sync",
  "상단 국가 버튼을 바꾸면 TOP6와 전체 순위도 함께 전환됩니다.",
  "시장 내 대화 비중",
  "renderCharacterMotion",
  "renderDialogMarketSwitcher",
  "renderDialogProfileSummary",
  "renderActiveDialog",
  "syncOpenDialogToSource",
  "switchDialogMarket",
  "resetDialogToLinkedMarket",
  "data-dialog-market",
  "data-dialog-sync",
  "dialog-market-status-pill",
  "dialog-market-switcher",
  "dialog-profile-summary",
  "one_line_intro",
  "detailed_intro",
  "공식 카탈로그 소개",
  "상단 국가 선택과 함께 전환됩니다.",
  "renderPeerComparison",
  "renderMarketAlertGuide",
  "renderNewCharacterSupply",
  "현재 평균 대화 최고",
  "최다 출시월",
  "renderSnapshotJourney",
  "renderPeriodComparison",
  "renderGlobalPanel",
  "renderCatalogSummary",
  "renderScheduledAiDiagnosis",
  "characterActivity",
  "activitySummaryForMarket",
  "renderStatsMarketSummary",
  "catalogHistoryForMarket",
  "marketCohortResponseRows",
  "marketGenreRows",
  "monthSeries",
  "공식 startAt 우선 · 누락 시 createdAt",
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

for (const script of ["scripts/refresh-public-snapshot.mjs", "scripts/crosscheck.mjs", "scripts/refresh-official-signals.mjs", "scripts/generate-ai-diagnosis.mjs"]) {
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
