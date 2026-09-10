import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const live = process.argv.includes("--live");
const write = process.argv.includes("--write");
const characters = JSON.parse(readFileSync(path.join(root, "data", "characters.json"), "utf8"));
const stats = JSON.parse(readFileSync(path.join(root, "data", "stats.json"), "utf8"));
const evidence = JSON.parse(readFileSync(path.join(root, "data", "investor-evidence.json"), "utf8"));
const officialSignals = JSON.parse(readFileSync(path.join(root, "data", "official-signals.json"), "utf8"));
const appSource = readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = readFileSync(path.join(root, "index.html"), "utf8");
const records = characters.records || [];
const checks = [];

const marketConfig = {
  kr: { site: "KR", label: "한국", url: "https://chat.toptoon.com/api/characters?limit=500" },
  jp: { site: "JP", label: "일본", url: "https://chat.toptoon.jp/api/characters?limit=500" },
  global: { site: "GLOBAL", label: "글로벌", url: "https://chat.global.toptoon.com/api/characters?limit=500" },
  tw: { site: "TW", label: "대만", url: "https://chat.toptoon.net/api/characters?limit=500" }
};

function addCheck(id, label, status, observed, expected, note, severity = status === "pass" ? "none" : "medium") {
  checks.push({ id, label, status, observed, expected, note, severity });
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function nearlyEqual(a, b, tolerance = 0.000001) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; ToptoonTrackerValidation/1.0)" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

const duplicateKeys = [];
const seen = new Set();
for (const row of records) {
  const key = `${row.site}:${row.character_id}`;
  if (seen.has(key)) duplicateKeys.push(key);
  seen.add(key);
}
addCheck("catalog-key-uniqueness", "시장+캐릭터 ID 고유성", duplicateKeys.length ? "block" : "pass", duplicateKeys.length, 0, duplicateKeys.length ? duplicateKeys.slice(0, 5).join(", ") : "중복 없음", duplicateKeys.length ? "critical" : "none");

const missingAssets = records.filter((row) => {
  const market = String(row.site || "").toLowerCase() === "global" ? "global" : String(row.site || "").toLowerCase();
  const filename = String(row.local_image || "").split("/").pop();
  return !filename || !existsSync(path.join(root, "assets", market, filename));
});
const assetStatus = missingAssets.length === 0 ? "pass" : (missingAssets.length <= 5 ? "warn" : "block");
const assetSeverity = missingAssets.length === 0 ? "none" : (missingAssets.length <= 5 ? "medium" : "high");
addCheck("asset-coverage", "로컬 이미지 참조", assetStatus, records.length - missingAssets.length, records.length, missingAssets.length ? `${missingAssets.length}개 이미지 누락` : "모든 레코드에 로컬 이미지 존재", assetSeverity);

const emptyWork = records.filter((row) => !row.work_title).length;
addCheck("work-title-completeness", "작품명 후보 필드", emptyWork ? "warn" : "pass", records.length - emptyWork, records.length, "첫 번째 해시태그를 작품명 후보로 사용하므로 정식 작품명과 다를 수 있음", "medium");

const snapshots = Object.values(characters.market_snapshots || {}).map((row) => Date.parse(row.captured_at)).filter(Number.isFinite);
const snapshotSpreadSeconds = snapshots.length ? (Math.max(...snapshots) - Math.min(...snapshots)) / 1000 : null;
addCheck("catalog-snapshot-alignment", "4개 시장 수집 시각 정렬", snapshotSpreadSeconds != null && snapshotSpreadSeconds <= 60 ? "pass" : "warn", snapshotSpreadSeconds, "≤ 60초", snapshots.length ? "같은 실행에서 수집한 시장별 스냅샷 시각 차이" : "시장별 스냅샷 메타데이터 없음", snapshots.length ? "low" : "high");

const localCatalogs = {};
for (const [key, config] of Object.entries(marketConfig)) {
  const rows = records.filter((row) => row.site === config.site);
  localCatalogs[key] = { label: config.label, count: rows.length, chats: sum(rows, "chats"), views: sum(rows, "views"), live: null };
}

if (live) {
  const results = await Promise.all(Object.entries(marketConfig).map(async ([key, config]) => {
    let page = 1;
    const limit = 50;
    const rows = [];
    let total = 0;
    let totalPages = 1;
    const baseUrl = config.url.split("?")[0];
    while (page <= totalPages) {
      const payload = await fetchJson(`${baseUrl}?page=${page}&limit=${limit}`);
      const pageRows = payload?.data?.data || [];
      rows.push(...pageRows);
      total = Number(payload?.data?.pagination?.total ?? rows.length);
      totalPages = Number(payload?.data?.pagination?.totalPages ?? 1);
      if (!pageRows.length || rows.length >= total) break;
      page++;
    }
    return [key, { count: total || rows.length, chats: sum(rows, "chatCount"), views: sum(rows, "viewCount") }];
  }));
  for (const [key, current] of results) {
    localCatalogs[key].live = current;
    const local = localCatalogs[key];
    addCheck(`live-count-${key}`, `${local.label} 원본 목록 수`, local.count === current.count ? "pass" : "block", local.count, current.count, "로컬 스냅샷과 공개 API의 캐릭터 수 대조", local.count === current.count ? "none" : "critical");
    const chatDriftPct = current.chats ? ((current.chats - local.chats) / current.chats) * 100 : 0;
    addCheck(`live-chats-${key}`, `${local.label} 누적 채팅 시차`, Math.abs(chatDriftPct) <= 0.25 ? "pass" : "warn", local.chats, current.chats, `수집 이후 변동 ${chatDriftPct.toFixed(3)}% (누적 수치는 실시간 증가 가능)`, Math.abs(chatDriftPct) <= 0.25 ? "none" : "medium");
  }
}

const statsTotals = stats.site_comparison?.overall?.totals || {};
for (const key of Object.keys(marketConfig)) {
  const trackerTotal = Number(statsTotals[key] || 0);
  const localTotal = localCatalogs[key].chats;
  const driftPct = localTotal ? ((localTotal - trackerTotal) / localTotal) * 100 : 0;
  addCheck(`worker-catalog-${key}`, `${marketConfig[key].label} Worker↔직접 관측`, nearlyEqual(localTotal, trackerTotal) ? "pass" : "warn", trackerTotal, localTotal, `서로 다른 수집 파이프라인의 누적 채팅 차이 ${driftPct.toFixed(3)}%`, nearlyEqual(localTotal, trackerTotal) ? "none" : "medium");
}

const dailyChatRows = stats.daily_chat_totals?.rows || [];
const constants = stats.revenue_nowcast?.constants || {};
const meanDelta = dailyChatRows.length ? sum(dailyChatRows, "delta") / dailyChatRows.length : 0;
const recomputedRevenue = meanDelta * 30 * Number(constants.rev_per_session || 0);
const reportedRevenue = Number(stats.revenue_nowcast?.latest?.revenue_mid || 0);
addCheck("revenue-nowcast-formula", "한국 월매출 런레이트 재계산", nearlyEqual(recomputedRevenue, reportedRevenue, 1) ? "pass" : "block", Math.round(recomputedRevenue), reportedRevenue, "평균 일간 채팅 증가×30일×세션당매출 가정", nearlyEqual(recomputedRevenue, reportedRevenue, 1) ? "none" : "critical");

const margin = Number(constants.net_margin || 0);
const recomputedProfit = reportedRevenue * margin;
const reportedProfit = Number(stats.revenue_nowcast?.latest?.profit_mid || 0);
addCheck("profit-nowcast-formula", "순이익 런레이트 재계산", nearlyEqual(recomputedProfit, reportedProfit, 1) ? "pass" : "block", Math.round(recomputedProfit), reportedProfit, "매출 런레이트×회사 주장 기반 마진 가정", nearlyEqual(recomputedProfit, reportedProfit, 1) ? "none" : "critical");

const siteRevenue = stats.site_revenue || {};
const summedSiteRevenue = Object.values(siteRevenue.per_site || {}).reduce((total, row) => total + Number(row.revenue_mid || 0), 0);
addCheck("all-market-revenue-scope", "4개국 최근 런레이트 범위", nearlyEqual(summedSiteRevenue, siteRevenue.grand_total_mid, 1) ? "pass" : "block", summedSiteRevenue, Number(siteRevenue.grand_total_mid || 0), "시장별 런레이트 합계와 4개국 합계를 동일 범위로 대조", nearlyEqual(summedSiteRevenue, siteRevenue.grand_total_mid, 1) ? "none" : "critical");

const benchmark = stats.revenue_nowcast?.ir_benchmark || {};
const benchmarkHasSource = Boolean(benchmark.source_id || benchmark.source_url);
addCheck("ir-benchmark-provenance", "월 9억원 비교값 출처", benchmarkHasSource ? "pass" : "warn", benchmarkHasSource ? benchmark.source_id || benchmark.source_url : "출처 없음", "원문 URL 또는 source_id", "출처가 확인되기 전 회사 공식 제시값으로 단정하지 않음", benchmarkHasSource ? "none" : "high");

const forbiddenDisplayClaims = [
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
];
const leakedClaims = forbiddenDisplayClaims.filter((text) => `${appSource}\n${indexSource}`.includes(text));
addCheck("display-semantic-guard", "근거 없는 화면 수치 차단", leakedClaims.length ? "block" : "pass", leakedClaims, [], leakedClaims.length ? "근거가 없거나 현재 데이터와 다른 고정 문구 발견" : "금지된 고정 수치 없음", leakedClaims.length ? "critical" : "none");

const kisProvider = officialSignals.providers?.kis || {};
const halt = kisProvider.market_alert?.trading_halt || {};
const haltDate = String(halt.judgment_date || "").replaceAll("-", "");
const haltHistoryClose = (kisProvider.price_history || []).find((row) => row.date === haltDate)?.close ?? null;
const haltThreshold = Number(halt.trigger_price_raw || 0);
const haltExpectedCondition = haltHistoryClose == null || !haltThreshold ? null : Number(haltHistoryClose) >= haltThreshold;
const haltTied = haltHistoryClose != null
  && Number(halt.observed_close) === Number(haltHistoryClose)
  && halt.condition_met === haltExpectedCondition;
addCheck("krx-halt-date-tieout", "거래정지 판단일 종가 대조", haltHistoryClose == null ? "warn" : haltTied ? "pass" : "block", halt.observed_close ?? null, haltHistoryClose, "최신 주가가 아닌 공시 판단일 종가로 조건을 평가", haltHistoryClose == null ? "high" : haltTied ? "none" : "critical");

const cachedWithoutTimestamp = Object.entries(officialSignals.providers || {})
  .filter(([, provider]) => provider.status === "cached" && (!provider.observed_at || !provider.attempted_at))
  .map(([id]) => id);
addCheck("cached-provider-freshness", "캐시 관측시각 보존", cachedWithoutTimestamp.length ? "block" : "pass", cachedWithoutTimestamp, [], "캐시 재사용 시 실제 관측시각과 갱신 시도시각을 분리", cachedWithoutTimestamp.length ? "high" : "none");

addCheck("ai-chat-revenue-tieout", "AI챗 매출 공시 연결", "warn", "별도 공시 없음", "별도 매출·유료 이용자·ASP", "반기보고서는 플랫폼 매출만 제시하며 AI챗 매출을 분리하지 않음. 트래커 넛캐스트를 공시 매출로 간주할 수 없음", "high");
addCheck("overseas-asp", "해외 결제단가 검증", "warn", "한국 단가 임시 적용", "국가별 실제 ASP", "일본·글로벌·대만 매출 넛캐스트는 한국 세션당매출을 그대로 적용", "high");
addCheck("profit-margin-basis", "AI챗 순이익률 검증", "warn", `${(margin * 100).toFixed(0)}% 가정`, "공시된 AI챗 원가·마진", "연결 영업이익률과 AI챗 단위경제를 분리할 수 없음", "high");

const filing = evidence.filing_snapshot;
const market = evidence.market_snapshot;
const marketCap = market.close * market.shares_outstanding;
const priceChangePct = ((market.close / market.reference_close) - 1) * 100;
const netCashExLease = filing.cash_and_cash_equivalents - filing.short_term_borrowings;
const passCount = checks.filter((item) => item.status === "pass").length;
const warnCount = checks.filter((item) => item.status === "warn").length;
const blockCount = checks.filter((item) => item.status === "block").length;

const payload = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  mode: live ? "live-crosscheck" : "local-crosscheck",
  overall_status: blockCount ? "needs-revision" : warnCount ? "share-with-caveats" : "ready-to-share",
  summary: { pass: passCount, warn: warnCount, block: blockCount },
  definitions: {
    grain: "시장×캐릭터 공개 누적 스냅샷",
    timezone: "Asia/Seoul display; source APIs may store UTC timestamps",
    observed_metrics: "공개 API의 누적 조회수·누적 채팅수",
    modeled_metrics: "누적 채팅 델타에 가정 단가·마진을 적용한 넛캐스트"
  },
  catalogs: localCatalogs,
  checks,
  investor: {
    ...evidence,
    derived: {
      market_cap: marketCap,
      price_change_from_reference_pct: priceChangePct,
      net_cash_excluding_lease_liabilities: netCashExLease,
      operating_cash_conversion_pct: filing.net_income ? (filing.operating_cash_flow / filing.net_income) * 100 : null,
      h1_operating_margin_pct: filing.revenue ? (filing.operating_profit / filing.revenue) * 100 : null
    }
  },
  required_caveats: [
    "조회수와 채팅수는 유료 결제·유료 세션·순매출이 아니다.",
    "작품명은 공개 API의 첫 번째 해시태그에서 추론하며 정식 작품명 필드가 아니다.",
    "Worker 통계와 직접 관측 카탈로그는 수집 시각과 파이프라인이 달라 누적 합계가 일치하지 않을 수 있다.",
    "AI챗 별도 매출, 결제자 비율, 국가별 ASP, API 비용, IP 정산, 순이익률은 공시로 검증되지 않았다.",
    "월 9억원 비교값은 원문 출처가 연결되기 전까지 회사 공식 가이던스로 단정하지 않는다.",
    "화면의 최근 주가는 KIS 자동 조회값이지만 과거 기준가·시장조치·수급 판단은 KRX 공시와 별도로 재확인해야 한다."
  ]
};

if (write) {
  writeFileSync(path.join(root, "data", "validation.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(path.join(root, "data", "validation.js"), `window.TOPTOON_VALIDATION=${JSON.stringify(payload)};\n`, "utf8");
}

console.log(JSON.stringify({ overall_status: payload.overall_status, summary: payload.summary, catalogs: payload.catalogs }, null, 2));
if (blockCount) process.exitCode = 1;
