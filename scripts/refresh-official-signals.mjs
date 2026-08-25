import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const peerUniverse = [
  { ticker: "207760", name: "미스터블루", role: "Core", focus: "웹툰 플랫폼·콘텐츠 제작" },
  { ticker: "020120", name: "키다리스튜디오", role: "Core", focus: "웹툰·웹소설 플랫폼/IP" },
  { ticker: "417180", name: "핑거스토리", role: "Secondary", focus: "웹툰·웹소설 플랫폼" },
  { ticker: "263720", name: "디앤씨미디어", role: "Secondary", focus: "웹소설·웹툰 IP 출판" }
];

async function loadLocalEnvironment() {
  try {
    const body = await readFile(join(projectRoot, ".env.local"), "utf8");
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
      if (/^[A-Z][A-Z0-9_]*$/.test(key) && process.env[key] == null) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function dateCompact(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = payload.error_code || payload.msg_cd || payload.code || "";
      const message = payload.error_description || payload.msg1 || payload.message || "";
      throw new Error([`HTTP ${response.status}`, code, message].filter(Boolean).join(" · "));
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBytes(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

function extractFirstZipEntry(archive) {
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("OpenDART corporation-code ZIP footer missing");
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (archive.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error("OpenDART corporation-code ZIP directory missing");
  const method = archive.readUInt16LE(centralOffset + 10);
  const compressedSize = archive.readUInt32LE(centralOffset + 20);
  const localOffset = archive.readUInt32LE(centralOffset + 42);
  if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("OpenDART corporation-code ZIP entry missing");
  const nameLength = archive.readUInt16LE(localOffset + 26);
  const extraLength = archive.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const compressed = archive.subarray(start, start + compressedSize);
  if (method === 0) return compressed;
  if (method === 8) return inflateRawSync(compressed);
  throw new Error(`Unsupported OpenDART ZIP compression method ${method}`);
}

async function resolveOpenDartCorpCode(apiKey) {
  if (process.env.OPENDART_CORP_CODE) return process.env.OPENDART_CORP_CODE;
  const stockCode = process.env.KIS_STOCK_CODE || "134580";
  const cacheDir = join(projectRoot, ".runtime");
  const cachePath = join(cacheDir, "opendart-company.json");
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    if (cached.stock_code === stockCode && /^\d{8}$/.test(cached.corp_code || "")) return cached.corp_code;
  } catch {}

  const archive = await fetchBytes(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(apiKey)}`);
  const xml = extractFirstZipEntry(archive).toString("utf8");
  const entries = xml.match(/<list>[\s\S]*?<\/list>/g) || [];
  const entry = entries.find((block) => new RegExp(`<stock_code>\\s*${stockCode}\\s*<\\/stock_code>`).test(block));
  const corpCode = entry?.match(/<corp_code>\s*(\d{8})\s*<\/corp_code>/)?.[1];
  const corpName = entry?.match(/<corp_name>\s*([^<]+?)\s*<\/corp_name>/)?.[1] || "";
  if (!corpCode) throw new Error(`OpenDART corporation code not found for stock ${stockCode}`);
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify({ stock_code: stockCode, corp_code: corpCode, corp_name: corpName })}\n`, "utf8");
  return corpCode;
}

async function refreshOpenDart() {
  const apiKey = process.env.OPENDART_API_KEY;
  if (!apiKey) return { status: "skipped", note: "OPENDART_API_KEY 필요" };
  const corpCode = await resolveOpenDartCorpCode(apiKey);
  const end = new Date();
  const begin = new Date(end);
  begin.setUTCDate(begin.getUTCDate() - 180);
  const params = new URLSearchParams({
    crtfc_key: apiKey,
    bgn_de: dateCompact(begin),
    end_de: dateCompact(end),
    sort: "date",
    sort_mth: "desc",
    page_count: "20",
    corp_code: corpCode
  });
  const payload = await fetchJson(`https://opendart.fss.or.kr/api/list.json?${params}`);
  if (!['000', '013'].includes(payload.status)) throw new Error(`OpenDART status ${payload.status || "unknown"}`);
  const rows = payload.list || [];
  return {
    status: "ok",
    source: "OpenDART 공시검색",
    note: `종목코드 ${process.env.KIS_STOCK_CODE || "134580"}의 회사 고유번호를 자동 확인해 최근 180일 조회`,
    corp_code: corpCode,
    disclosures: rows.slice(0, 10).map((item) => ({
      company: item.corp_name,
      report: item.report_nm,
      receipt_no: item.rcept_no,
      filed_at: item.rcept_dt,
      filer: item.flr_nm,
      url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(item.rcept_no)}`
    }))
  };
}

async function refreshKis() {
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;
  const ticker = process.env.KIS_STOCK_CODE || "134580";
  if (!appKey || !appSecret) return { status: "skipped", note: "KIS_APP_KEY와 KIS_APP_SECRET 필요" };
  const base = "https://openapi.koreainvestment.com:9443";
  const token = await fetchJson(`${base}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", appkey: appKey, appsecret: appSecret })
  });
  if (!token.access_token) throw new Error("KIS access token missing");
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token.access_token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHKST01010100"
  };
  const fetchQuote = async (stockCode) => {
    const params = new URLSearchParams({ fid_cond_mrkt_div_code: "J", fid_input_iscd: stockCode });
    const quote = await fetchJson(`${base}/uapi/domestic-stock/v1/quotations/inquire-price?${params}`, { headers });
    if (quote.rt_cd !== "0") throw new Error(`KIS ${stockCode} status ${quote.msg_cd || "unknown"}`);
    const output = quote.output || {};
    const listedShares = Number(output.lstn_stcn || 0);
    const price = Number(output.stck_prpr || 0);
    const changeSign = String(output.prdy_vrss_sign || "");
    const direction = ["1", "2"].includes(changeSign) ? 1 : ["4", "5"].includes(changeSign) ? -1 : 0;
    const rawChange = Number(output.prdy_vrss || 0);
    const rawChangePct = Number(output.prdy_ctrt || 0);
    const change = direction ? Math.abs(rawChange) * direction : rawChange;
    const changePct = direction ? Math.abs(rawChangePct) * direction : rawChangePct;
    return {
      price,
      previous_close: Number(output.stck_sdpr || 0) || price - change,
      open: Number(output.stck_oprc || 0) || null,
      high: Number(output.stck_hgpr || 0) || null,
      low: Number(output.stck_lwpr || 0) || null,
      change,
      change_pct: changePct,
      change_sign: changeSign || null,
      volume: Number(output.acml_vol || 0),
      shares_outstanding: listedShares,
      market_cap_krw: Number(output.hts_avls || 0) * 100000000 || price * listedShares,
      per: Number(output.per || 0) || null,
      pbr: Number(output.pbr || 0) || null
    };
  };
  const primaryQuote = await fetchQuote(ticker);
  const historyStart = new Date();
  historyStart.setUTCDate(historyStart.getUTCDate() - 45);
  const historyParams = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: ticker,
    FID_INPUT_DATE_1: dateCompact(historyStart),
    FID_INPUT_DATE_2: dateCompact(new Date()),
    FID_PERIOD_DIV_CODE: "D",
    FID_ORG_ADJ_PRC: "0"
  });
  let priceHistory = [];
  try {
    const historyPayload = await fetchJson(`${base}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${historyParams}`, {
      headers: { ...headers, tr_id: "FHKST03010100" }
    });
    if (historyPayload.rt_cd !== "0") throw new Error(`KIS history status ${historyPayload.msg_cd || "unknown"}`);
    priceHistory = (historyPayload.output2 || [])
      .map((row) => ({
        date: String(row.stck_bsop_date || ""),
        close: Number(row.stck_clpr || 0),
        high: Number(row.stck_hgpr || 0),
        low: Number(row.stck_lwpr || 0)
      }))
      .filter((row) => /^\d{8}$/.test(row.date) && row.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    priceHistory = [];
  }
  const closeOn = (date) => priceHistory.find((row) => row.date === date)?.close || null;
  const haltReferenceClose = closeOn("20260820");
  const release15ReferenceClose = closeOn("20260812");
  const release5ReferenceClose = closeOn("20260827");
  const rawHaltThreshold = haltReferenceClose ? haltReferenceClose * 1.4 : null;
  const marketAlert = {
    status: haltReferenceClose ? "calculated" : "partial",
    trading_halt: {
      judgment_date: "2026-08-24",
      halt_date: "2026-08-25",
      halt_days: 1,
      reference_date: "2026-08-20",
      reference_close: haltReferenceClose,
      trigger_pct: 40,
      trigger_price_raw: rawHaltThreshold,
      observed_close: primaryQuote.price,
      condition_met: rawHaltThreshold == null ? null : primaryQuote.price >= rawHaltThreshold,
      source_url: "https://kind.krx.co.kr/external/2026/08/21/000686/20260821001992/70835.htm"
    },
    warning_release: {
      earliest_judgment_date: "2026-09-03",
      five_day_reference_date: "2026-08-27",
      five_day_reference_close: release5ReferenceClose,
      five_day_limit_pct: 45,
      five_day_limit_raw: release5ReferenceClose ? release5ReferenceClose * 1.45 : null,
      fifteen_day_reference_date: "2026-08-12",
      fifteen_day_reference_close: release15ReferenceClose,
      fifteen_day_limit_pct: 75,
      fifteen_day_limit_raw: release15ReferenceClose ? release15ReferenceClose * 1.75 : null,
      must_not_be_fifteen_day_high: true,
      source_url: "https://kind.krx.co.kr/external/2026/08/20/000602/20260820001386/70804.htm"
    },
    calculation_note: "KRX 공시 산식을 KIS 일별 종가에 적용한 참고 계산. 최종 시장조치는 KRX 공시를 우선 확인."
  };
  const previousPeers = new Map((previousProviders?.kis?.peers || []).map((p) => [p.ticker, p]));
  const peers = [];
  for (const peer of peerUniverse) {
    try {
      await new Promise((r) => setTimeout(r, 250));
      peers.push({ ...peer, ...(await fetchQuote(peer.ticker)), status: "ok" });
    } catch (error) {
      const prev = previousPeers.get(peer.ticker);
      if (prev && (prev.status === "ok" || prev.status === "cached") && Number(prev.price || 0) > 0) {
        peers.push({ ...prev, status: "cached", note: `시세 갱신 지연 · 이전 정상값 유지 (${String(error.message || error)})` });
      } else {
        peers.push({ ...peer, status: "error", note: String(error.message || error) });
      }
    }
  }
  return {
    status: "ok",
    source: "한국투자증권 국내주식 현재가",
    ticker,
    quote: primaryQuote,
    price_history: priceHistory,
    market_alert: marketAlert,
    peers,
    peer_note: "동일 업종의 완전한 비교군이 아닌 웹툰 플랫폼·IP 사업 노출 기준 스크리닝 피어"
  };
}

async function refreshFred() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return { status: "skipped", note: "FRED_API_KEY 필요" };
  const params = new URLSearchParams({
    series_id: "DEXKOUS",
    api_key: apiKey.toLowerCase(),
    file_type: "json",
    sort_order: "desc",
    limit: "10"
  });
  const payload = await fetchJson(`https://api.stlouisfed.org/fred/series/observations?${params}`);
  const latest = (payload.observations || []).find((item) => item.value !== ".");
  return {
    status: "ok",
    source: "FRED DEXKOUS",
    observation: latest ? { date: latest.date, value: Number(latest.value), unit: "KRW per USD" } : null
  };
}

await loadLocalEnvironment();
let previousProviders = {};
try {
  previousProviders = JSON.parse(await readFile(join(projectRoot, "data", "official-signals.json"), "utf8")).providers || {};
} catch {
  previousProviders = {};
}
const tasks = [
  ["opendart", refreshOpenDart],
  ["kis", refreshKis],
  ["fred", refreshFred]
];
const providers = {};
for (const [id, task] of tasks) {
  try {
    providers[id] = await task();
  } catch (error) {
    const note = error?.name === "AbortError" ? "요청 시간 초과" : String(error.message || error);
    const expectedTicker = process.env.KIS_STOCK_CODE || "134580";
    const canReusePrevious = ["ok", "cached"].includes(previousProviders[id]?.status)
      && (id !== "kis" || previousProviders[id]?.ticker === expectedTicker);
    providers[id] = canReusePrevious
      ? { ...previousProviders[id], status: "cached", note: `최근 갱신 실패 · 이전 정상 응답 유지 (${note})` }
      : { status: "error", note };
  }
}

const output = { generated_at: new Date().toISOString(), providers };
const jsonBody = `${JSON.stringify(output, null, 2)}\n`;
await writeFile(join(projectRoot, "data", "official-signals.json"), jsonBody, "utf8");
await writeFile(join(projectRoot, "data", "official-signals.js"), `window.TOPTOON_OFFICIAL_SIGNALS = ${JSON.stringify(output)};\n`, "utf8");

const summary = Object.entries(providers).map(([id, result]) => `${id}:${result.status}`).join(" · ");
console.log(`Official signal refresh complete: ${summary}`);
