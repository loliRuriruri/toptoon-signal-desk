import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
writeFileSync(path.join(dataDir, "characters.json"), `${JSON.stringify(catalogPayload, null, 2)}\n`, "utf8");
const slimRecords = records.map(({ locale, site, character_id, character_name, work_title, views, chats, local_image, safe_video_url, detail_url, source_id, source_updated_at }) => ({
  locale, site, character_id, character_name, work_title, views, chats, local_image, safe_video_url, detail_url, source_id, source_updated_at
}));
writeFileSync(path.join(dataDir, "characters.js"), `window.TOPTOON_DATA=${JSON.stringify({ generated_at: capturedAt, market_snapshots: catalogPayload.market_snapshots, counts, records: slimRecords })};document.documentElement.dataset.dataReady='true';\n`, "utf8");

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

console.log(JSON.stringify({ captured_at: capturedAt, counts, downloaded_asset_folders: markets.map((market) => market.key), stats_endpoints: Object.keys(statsEndpoints).length }, null, 2));
