import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const assetRoot = path.join(root, "assets");
const capturedAt = new Date().toISOString();

const markets = [
  { site: "KR", key: "kr", locale: "ko-KR", host: "https://chat.toptoon.com", sourceId: "SRC-CATALOG-KR" },
  { site: "JP", key: "jp", locale: "ja", host: "https://chat.toptoon.jp", sourceId: "SRC-CATALOG-JP" },
  { site: "GLOBAL", key: "global", locale: "en", host: "https://chat.global.toptoon.com", sourceId: "SRC-CATALOG-GLOBAL" },
  { site: "TW", key: "tw", locale: "zh-TW", host: "https://chat.toptoon.net", sourceId: "SRC-CATALOG-TW" }
];

const statsEndpoints = {
  revenue_nowcast: "revenue-nowcast",
  revenue_by_character: "revenue-by-character",
  coin_mix_ramp: "coin-mix-ramp",
  completion_ceiling: "completion-ceiling",
  growth_cannibalization: "growth-cannibalization",
  monthly_index: "monthly-index",
  totals_timeseries: "totals-timeseries",
  daily_totals: "daily-totals",
  daily_chat_totals: "daily-chat-totals",
  characters: "characters",
  site_comparison: "site-comparison",
  site_traction: "site-traction",
  site_revenue: "site-revenue"
};

mkdirSync(dataDir, { recursive: true });
mkdirSync(assetRoot, { recursive: true });

const previousCatalogPath = path.join(dataDir, "characters.json");
const previousActivityPath = path.join(dataDir, "character-activity.json");
let previousCatalog = null;
let previousActivity = null;
if (existsSync(previousCatalogPath)) {
  try {
    previousCatalog = JSON.parse(readFileSync(previousCatalogPath, "utf8"));
  } catch (error) {
    console.warn(`Previous catalog snapshot could not be read: ${error.message}`);
  }
}
if (existsSync(previousActivityPath)) {
  try {
    previousActivity = JSON.parse(readFileSync(previousActivityPath, "utf8"));
  } catch (error) {
    console.warn(`Previous activity history could not be read: ${error.message}`);
  }
}

function safeFilename(value) {
  return String(value || "character")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim();
}

function extensionFromUrl(url) {
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp"].includes(extension) ? extension : ".img";
}

async function fetchJson(url, referer) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; ToptoonTrackerValidation/1.0)", referer }
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function collectMarket(market) {
  const apiUrl = `${market.host}/api/characters?limit=500`;
  const payload = await fetchJson(apiUrl, `${market.host}/`);
  const rows = payload?.data?.data || [];
  const expected = Number(payload?.data?.pagination?.total ?? rows.length);
  if (payload?.success !== true || rows.length !== expected) {
    throw new Error(`${market.site} pagination mismatch: ${rows.length}/${expected}`);
  }

  const assetDir = path.join(assetRoot, market.key);
  mkdirSync(assetDir, { recursive: true });
  const records = [];
  for (const character of rows) {
    const sortedTags = [...(character.hashtags || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    const imageUrl = String(character.thumbnail || "");
    const safeVideoUrl = [character.safeVideoThumbnail, character.videoThumbnail]
      .map((value) => String(value || ""))
      .find((value) => /\.mp4$/i.test(value)) || "";
    let imageFile = "";
    if (imageUrl) {
      imageFile = `${String(character.id).padStart(3, "0")}_${safeFilename(character.name)}${extensionFromUrl(imageUrl)}`;
      const destination = path.join(assetDir, imageFile);
      if (!existsSync(destination)) {
        const imageResponse = await fetch(imageUrl, {
          headers: { "user-agent": "Mozilla/5.0", referer: `${market.host}/` }
        });
        if (!imageResponse.ok) throw new Error(`${imageUrl} returned HTTP ${imageResponse.status}`);
        writeFileSync(destination, Buffer.from(await imageResponse.arrayBuffer()));
      }
    }
    records.push({
      locale: market.locale,
      site: market.site,
      character_id: Number(character.id),
      character_name: String(character.name || ""),
      work_title: sortedTags[0]?.hashtag || null,
      views: Number(character.viewCount || 0),
      chats: Number(character.chatCount || 0),
      thumbnail_url: imageUrl || null,
      safe_video_url: safeVideoUrl || null,
      local_image: imageFile ? `images_${market.key}/${imageFile}` : null,
      detail_url: `${market.host}/detail/character/${character.id}`,
      source_id: market.sourceId,
      source_updated_at: character.updatedAt || null
    });
  }
  return { market, apiUrl, records, total: expected };
}

const marketResults = await Promise.all(markets.map(collectMarket));
const records = marketResults.flatMap((result) => result.records);
const counts = {
  kr: records.filter((row) => row.site === "KR").length,
  jp: records.filter((row) => row.site === "JP").length,
  global: records.filter((row) => row.site === "GLOBAL").length,
  tw: records.filter((row) => row.site === "TW").length,
  locale_records: records.length,
  unique_character_ids: new Set(records.map((row) => row.character_id)).size
};
const catalogPayload = {
  generated_at: capturedAt,
  source_note: "Four public catalogs collected in one run. Work title is inferred from the first sorted hashtag and is not a separately verified title field.",
  market_snapshots: Object.fromEntries(marketResults.map((result) => [result.market.key, { captured_at: capturedAt, source: result.apiUrl, count: result.total }])),
  counts,
  records
};

const previousByKey = new Map(
  (previousCatalog?.records || []).map((record) => [`${record.site}:${Number(record.character_id)}`, record])
);
const baselineAt = previousCatalog?.generated_at || null;
const baselineTime = baselineAt ? new Date(baselineAt).getTime() : Number.NaN;
const capturedTime = new Date(capturedAt).getTime();
const intervalSeconds = Number.isFinite(baselineTime) && Number.isFinite(capturedTime)
  ? Math.max(0, Math.round((capturedTime - baselineTime) / 1000))
  : null;

const activityMarkets = Object.fromEntries(marketResults.map((result) => {
  const rows = result.records.map((record) => {
    const previous = previousByKey.get(`${record.site}:${record.character_id}`);
    return {
      character_id: record.character_id,
      character_name: record.character_name,
      current_views: record.views,
      previous_views: previous ? Number(previous.views || 0) : null,
      delta: previous ? record.views - Number(previous.views || 0) : null,
      current_chats: record.chats,
      previous_chats: previous ? Number(previous.chats || 0) : null,
      chat_delta: previous ? record.chats - Number(previous.chats || 0) : null,
      baseline_at: previous ? baselineAt : null,
      last_seen: capturedAt,
      comparison_status: previous ? "matched" : "new"
    };
  });
  const matchedRows = rows.filter((row) => row.comparison_status === "matched");
  return [result.market.key, {
    site: result.market.site,
    source: result.apiUrl,
    baseline_at: baselineAt,
    captured_at: capturedAt,
    interval_seconds: intervalSeconds,
    record_count: rows.length,
    comparable_count: matchedRows.length,
    new_count: rows.length - matchedRows.length,
    views_delta: matchedRows.reduce((sum, row) => sum + row.delta, 0),
    chats_delta: matchedRows.reduce((sum, row) => sum + row.chat_delta, 0),
    negative_views_count: matchedRows.filter((row) => row.delta < 0).length,
    negative_chats_count: matchedRows.filter((row) => row.chat_delta < 0).length,
    rows
  }];
}));

function aggregateCatalogSnapshot(catalog, capturedAt) {
  if (!catalog?.records?.length || !capturedAt) return null;
  const snapshotMarkets = Object.fromEntries(markets.map((market) => {
    const marketRows = catalog.records.filter((row) => row.site === market.site);
    return [market.key, {
      characters: marketRows.length,
      views: marketRows.reduce((sum, row) => sum + Number(row.views || 0), 0),
      chats: marketRows.reduce((sum, row) => sum + Number(row.chats || 0), 0)
    }];
  }));
  return { captured_at: capturedAt, markets: snapshotMarkets };
}

const historyByTime = new Map();
for (const snapshot of previousActivity?.history || []) {
  if (snapshot?.captured_at && snapshot?.markets) historyByTime.set(snapshot.captured_at, snapshot);
}
const previousSnapshot = aggregateCatalogSnapshot(previousCatalog, previousCatalog?.generated_at);
const currentSnapshot = aggregateCatalogSnapshot(catalogPayload, capturedAt);
if (previousSnapshot) historyByTime.set(previousSnapshot.captured_at, previousSnapshot);
if (currentSnapshot) historyByTime.set(currentSnapshot.captured_at, currentSnapshot);
const history = [...historyByTime.values()]
  .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
  .slice(-120);

const activityPayload = {
  captured_at: capturedAt,
  baseline_at: baselineAt,
  interval_seconds: intervalSeconds,
  source_tier: "B",
  definition: "For each site and character ID, current public cumulative counter minus the immediately previous locally stored public catalog snapshot.",
  caveat: "This is a collection-interval change, not a daily metric or revenue. New characters without a prior row have null deltas; negative values are retained as source corrections or counter resets.",
  history,
  markets: activityMarkets
};

writeFileSync(path.join(dataDir, "characters.json"), `${JSON.stringify(catalogPayload, null, 2)}\n`, "utf8");
const slimRecords = records.map(({ locale, site, character_id, character_name, work_title, views, chats, local_image, safe_video_url, detail_url, source_id, source_updated_at }) => ({
  locale, site, character_id, character_name, work_title, views, chats, local_image, safe_video_url, detail_url, source_id, source_updated_at
}));
writeFileSync(path.join(dataDir, "characters.js"), `window.TOPTOON_DATA=${JSON.stringify({ generated_at: capturedAt, market_snapshots: catalogPayload.market_snapshots, counts, records: slimRecords })};document.documentElement.dataset.dataReady='true';\n`, "utf8");
writeFileSync(path.join(dataDir, "character-activity.json"), `${JSON.stringify(activityPayload, null, 2)}\n`, "utf8");
writeFileSync(path.join(dataDir, "character-activity.js"), `window.TOPTOON_CHARACTER_ACTIVITY=${JSON.stringify(activityPayload)};\n`, "utf8");

const workerBase = "https://toptoon-tracker.john6428.workers.dev";
const statsPairs = await Promise.all(Object.entries(statsEndpoints).map(async ([key, endpoint]) => [key, await fetchJson(`${workerBase}/api/${endpoint}`, `${workerBase}/`)]));
const statsPayload = {
  captured_at: new Date().toISOString(),
  source: workerBase,
  source_tier: "C",
  caveat: "Public third-party tracker snapshot. Revenue nowcasts, IR benchmarks and margin assumptions are not audited financial statements.",
  ...Object.fromEntries(statsPairs)
};
writeFileSync(path.join(dataDir, "stats.json"), `${JSON.stringify(statsPayload, null, 2)}\n`, "utf8");
writeFileSync(path.join(dataDir, "stats.js"), `window.TOPTOON_STATS=${JSON.stringify(statsPayload)};\n`, "utf8");

console.log(JSON.stringify({
  captured_at: capturedAt,
  activity_baseline_at: baselineAt,
  activity_interval_seconds: intervalSeconds,
  activity_comparable_counts: Object.fromEntries(Object.entries(activityMarkets).map(([key, value]) => [key, value.comparable_count])),
  activity_history_snapshots: history.length,
  counts,
  downloaded_asset_folders: markets.map((market) => market.key),
  stats_endpoints: Object.keys(statsEndpoints).length
}, null, 2));
