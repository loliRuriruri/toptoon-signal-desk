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
const previousPromotionsPath = path.join(dataDir, "official-promotions.json");
const previousHomeBannersPath = path.join(dataDir, "official-home-banners.json");
let previousCatalog = null;
let previousActivity = null;
let previousPromotions = null;
let previousHomeBanners = null;
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
if (existsSync(previousPromotionsPath)) {
  try {
    previousPromotions = JSON.parse(readFileSync(previousPromotionsPath, "utf8"));
  } catch (error) {
    console.warn(`Previous promotion snapshot could not be read: ${error.message}`);
  }
}
if (existsSync(previousHomeBannersPath)) {
  try {
    previousHomeBanners = JSON.parse(readFileSync(previousHomeBannersPath, "utf8"));
  } catch (error) {
    console.warn(`Previous official home banner snapshot could not be read: ${error.message}`);
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

async function fetchJson(url, referer, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; ToptoonTrackerValidation/1.0)", referer }
      });
      if (!response.ok) {
        if (attempt < retries && (response.status >= 500 || response.status === 429)) {
          await new Promise((r) => setTimeout(r, attempt * 1200));
          continue;
        }
        throw new Error(`${url} returned HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 1200));
        continue;
      }
      throw err;
    }
  }
}

async function fetchText(url, referer, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; ToptoonTrackerValidation/1.0)", referer }
      });
      if (!response.ok) {
        if (attempt < retries && (response.status >= 500 || response.status === 429)) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
          continue;
        }
        throw new Error(`${url} returned HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }
      throw error;
    }
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<!--.*?-->/gs, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function htmlText(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPromotionHeadline(homepageHtml, route, characterName) {
  const routePattern = escapeRegExp(route);
  const anchorMatch = homepageHtml.match(new RegExp(`<a\\b[^>]*href=["']${routePattern}["'][^>]*>([\\s\\S]*?)<\\/a>`, "i"));
  if (!anchorMatch) return null;
  const headlineMatch = anchorMatch[1].match(/<span\b[^>]*class=["'][^"']*line-clamp-1[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const headline = htmlText(headlineMatch?.[1] || anchorMatch[1]);
  if (!headline || !headline.includes(String(characterName || ""))) return null;
  return headline;
}

function extractInitialBanners(homepageHtml) {
  if (!homepageHtml) return [];

  // The public home pages stream the carousel state in a Next.js flight
  // payload. Decode that string first so escaped quotes inside a banner title
  // cannot be mistaken for the end of the JSON string.
  for (const scriptMatch of homepageHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const scriptBody = scriptMatch[1];
    const pushIndex = scriptBody.indexOf("self.__next_f.push([1,");
    if (pushIndex < 0) continue;
    const stringStart = scriptBody.indexOf('"', pushIndex);
    if (stringStart < 0) continue;

    let stringEnd = stringStart + 1;
    let escaped = false;
    for (; stringEnd < scriptBody.length; stringEnd += 1) {
      const character = scriptBody[stringEnd];
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        break;
      }
    }
    if (stringEnd >= scriptBody.length) continue;

    let flightText;
    try {
      flightText = JSON.parse(scriptBody.slice(stringStart, stringEnd + 1));
    } catch {
      continue;
    }

    const marker = 'initialBanners":';
    const markerIndex = flightText.indexOf(marker);
    if (markerIndex < 0) continue;
    const arrayStart = flightText.indexOf("[", markerIndex + marker.length);
    if (arrayStart < 0) continue;

    let depth = 0;
    let inString = false;
    let stringEscaped = false;
    let arrayEnd = -1;
    for (let index = arrayStart; index < flightText.length; index += 1) {
      const character = flightText[index];
      if (inString) {
        if (stringEscaped) stringEscaped = false;
        else if (character === "\\") stringEscaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
      } else if (character === "[") {
        depth += 1;
      } else if (character === "]") {
        depth -= 1;
        if (depth === 0) {
          arrayEnd = index + 1;
          break;
        }
      }
    }
    if (arrayEnd < 0) continue;

    try {
      const banners = JSON.parse(flightText.slice(arrayStart, arrayEnd));
      return Array.isArray(banners) ? banners : [];
    } catch {
      continue;
    }
  }
  return [];
}

function bannerImageUrl(assetsUrl, homepageUrl) {
  try {
    const url = new URL(String(assetsUrl || ""), homepageUrl);
    if (/\.mp4$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\.mp4$/i, "_thumb.webp");
    return url.href;
  } catch {
    return "";
  }
}

function extractOfficialHomeBannerItems(homepageHtml, homepageUrl) {
  return extractInitialBanners(homepageHtml)
    .filter((banner) => banner && (banner.title || banner.infoText || Array.isArray(banner.badge) && banner.badge.length))
    .map((banner, index) => {
      let detailUrl = null;
      try {
        detailUrl = banner.linkUrl ? new URL(String(banner.linkUrl), homepageUrl).href : null;
      } catch {
        detailUrl = null;
      }
      const characterIdMatch = String(banner.linkUrl || "").match(/\/character\/(\d+)/i);
      const imageUrl = bannerImageUrl(banner.assetsUrl, homepageUrl);
      return {
        position: index + 1,
        banner_id: Number.isFinite(Number(banner.id)) ? Number(banner.id) : null,
        title: String(banner.title || "").replace(/\s+/g, " ").trim() || null,
        info_text: String(banner.infoText || "").replace(/\s+/g, " ").trim() || null,
        badges: Array.isArray(banner.badge) ? banner.badge.map((value) => String(value || "").trim()).filter(Boolean) : [],
        character_id: characterIdMatch ? Number(characterIdMatch[1]) : null,
        detail_url: detailUrl,
        asset_url: String(banner.assetsUrl || "").trim() || null,
        image_url: imageUrl || null,
        source_url: homepageUrl
      };
    })
    .filter((item) => item.image_url)
    .slice(0, 8);
}

async function cacheOfficialHomeBannerImages(items, market) {
  const assetDir = path.join(assetRoot, "home-banners", market.key);
  mkdirSync(assetDir, { recursive: true });
  const cachedItems = [];
  for (const item of items) {
    const remoteImageUrl = item.image_url;
    if (!remoteImageUrl) continue;
    const remotePath = new URL(remoteImageUrl).pathname;
    const baseName = safeFilename(path.basename(remotePath) || `banner-${item.position}.webp`);
    const fileName = `${String(item.banner_id || item.position).padStart(3, "0")}_${baseName}`;
    const destination = path.join(assetDir, fileName);
    if (!existsSync(destination)) {
      const imageResponse = await fetch(remoteImageUrl, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; ToptoonTrackerValidation/1.0)", referer: `${market.host}/` }
      });
      if (!imageResponse.ok) throw new Error(`${remoteImageUrl} returned HTTP ${imageResponse.status}`);
      writeFileSync(destination, Buffer.from(await imageResponse.arrayBuffer()));
    }
    cachedItems.push({
      ...item,
      image_url: `assets/home-banners/${market.key}/${fileName}`,
      source_image_url: remoteImageUrl
    });
  }
  return cachedItems;
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
    const oneLineIntro = String(character.oneLineIntro || "").trim() || null;
    const detailedIntro = String(character.detailedIntro || "").trim() || null;
    const customWorldSummary = String(character.customWorldSummary || "").trim() || null;
    const hashtags = sortedTags
      .map((tag) => String(tag?.hashtag || "").trim())
      .filter(Boolean)
      .slice(0, 8);
    records.push({
      locale: market.locale,
      site: market.site,
      character_id: Number(character.id),
      character_name: String(character.name || ""),
      work_title: sortedTags[0]?.hashtag || null,
      genre: String(character.genre || "other"),
      one_line_intro: oneLineIntro,
      detailed_intro: detailedIntro,
      custom_world_summary: customWorldSummary,
      hashtags,
      views: Number(character.viewCount || 0),
      chats: Number(character.chatCount || 0),
      thumbnail_url: imageUrl || null,
      safe_video_url: safeVideoUrl || null,
      local_image: imageFile ? `images_${market.key}/${imageFile}` : null,
      detail_url: `${market.host}/detail/character/${character.id}`,
      source_id: market.sourceId,
      created_at: character.createdAt || null,
      start_at: character.startAt || null,
      published_at: character.startAt || character.createdAt || null,
      source_updated_at: character.updatedAt || null
    });
  }
  const promotionCandidates = rows
    .filter((character) => (character.badges || []).includes("price_promotion"))
    .map((character) => ({
      character_id: Number(character.id),
      character_name: String(character.name || ""),
      api_badge: "price_promotion",
      detail_url: `${market.host}/detail/character/${character.id}`
    }));
  return { market, apiUrl, records, total: expected, promotionCandidates };
}

const marketResults = await Promise.all(markets.map(collectMarket));

async function collectOfficialPromotions(result) {
  const { market, apiUrl, promotionCandidates } = result;
  let homepageHtml = "";
  let homepageError = null;
  try {
    homepageHtml = await fetchText(`${market.host}/`, `${market.host}/`);
  } catch (error) {
    homepageError = error.message;
  }

  const items = promotionCandidates.map((candidate) => {
    const route = `/detail/character/${candidate.character_id}`;
    const headline = homepageHtml
      ? extractPromotionHeadline(homepageHtml, route, candidate.character_name)
      : null;
    return {
      ...candidate,
      headline,
      verification: headline ? "api-and-homepage" : "api-badge-only",
      source_url: headline ? `${market.host}/` : apiUrl
    };
  });
  const verifiedCount = items.filter((item) => item.verification === "api-and-homepage").length;
  const signature = items
    .map((item) => `${item.character_id}:${item.headline || item.api_badge}`)
    .sort()
    .join("|");
  const previousMarket = previousPromotions?.markets?.[market.key] || null;
  const previousSignature = String(previousMarket?.signature || "");
  const change = signature === previousSignature
    ? (signature ? "continuing" : "none")
    : signature
      ? (previousSignature ? "changed" : "new")
      : (previousSignature ? "ended" : "none");

  const homeBannerItems = await cacheOfficialHomeBannerImages(
    extractOfficialHomeBannerItems(homepageHtml, `${market.host}/`),
    market
  );
  const bannerSignature = homeBannerItems
    .map((item) => `${item.banner_id || ""}:${item.title || ""}:${item.source_image_url || item.image_url || ""}`)
    .sort()
    .join("|");
  const previousBannerMarket = previousHomeBanners?.markets?.[market.key] || null;
  const previousBannerSignature = previousBannerMarket?.items?.length
    ? previousBannerMarket.items
      .map((item) => `${item.banner_id || ""}:${item.title || ""}:${item.source_image_url || item.image_url || ""}`)
      .sort()
      .join("|")
    : String(previousBannerMarket?.signature || "");
  const bannerChange = bannerSignature === previousBannerSignature
    ? (bannerSignature ? "continuing" : "none")
    : bannerSignature
      ? (previousBannerSignature ? "changed" : "new")
      : (previousBannerSignature ? "ended" : "none");

  return {
    key: market.key,
    promotion: {
    market: market.key,
    label: market.site,
    observed_at: capturedAt,
    homepage_url: `${market.host}/`,
    api_url: apiUrl,
    status: homepageError ? (items.length ? "partial" : "unavailable") : items.length && verifiedCount === items.length ? "verified" : items.length ? "partial" : "none",
    change,
    signature,
    homepage_error: homepageError,
    items
    },
    homeBanners: {
      market: market.key,
      label: market.site,
      observed_at: capturedAt,
      homepage_url: `${market.host}/`,
      status: homepageError ? (homeBannerItems.length ? "partial" : "unavailable") : homeBannerItems.length ? "ok" : "empty",
      change: bannerChange,
      signature: bannerSignature,
      homepage_error: homepageError,
      items: homeBannerItems
    }
  };
}

const officialHomeObservations = await Promise.all(marketResults.map(collectOfficialPromotions));
const promotionMarkets = Object.fromEntries(officialHomeObservations.map((observation) => [observation.key, observation.promotion]));
const homeBannerMarkets = Object.fromEntries(officialHomeObservations.map((observation) => [observation.key, observation.homeBanners]));
const promotionHistory = [
  ...(previousPromotions?.history || []),
  {
    captured_at: capturedAt,
    markets: Object.fromEntries(Object.entries(promotionMarkets).map(([key, value]) => [key, {
      status: value.status,
      change: value.change,
      signature: value.signature
    }]))
  }
].filter((entry, index, values) => entry?.captured_at && values.findIndex((candidate) => candidate.captured_at === entry.captured_at) === index)
  .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
  .slice(-192);
const promotionsPayload = {
  generated_at: capturedAt,
  source_tier: "A",
  definition: "Official promotion items require a price_promotion badge from the market catalog API. A headline is shown only when the same character link is also present on that market's official homepage.",
  caveat: "Promotion observations do not explain viewCount or chatCount changes. Traffic-source attribution requires a separate official announcement or referrer dataset.",
  markets: promotionMarkets,
  history: promotionHistory
};
const homeBannersPayload = {
  generated_at: capturedAt,
  source_tier: "A",
  definition: "Each item is a title, image and optional badge observed in the market's official home-page hero payload. It is not a traffic, conversion or event-causality signal.",
  caveat: "Only the official home payload is shown. A banner's presence does not prove why viewCount or chatCount changed.",
  markets: homeBannerMarkets
};
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
  source_note: "Four public catalogs collected in one run. Work title, genre, and character introduction fields are direct public API fields; published_at falls back to createdAt only when startAt is absent.",
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

function compactCharacterInterval(activity) {
  const seconds = Number(activity?.interval_seconds || 0);
  if (!activity?.captured_at || !activity?.baseline_at || !Number.isFinite(seconds) || seconds <= 0) return null;
  const compactMarkets = Object.fromEntries(markets.map((market) => {
    const rows = activity?.markets?.[market.key]?.rows || [];
    const comparable = rows
      .filter((row) => row?.comparison_status === "matched" && Number.isFinite(Number(row.delta)) && Number.isFinite(Number(row.chat_delta)))
      .map((row) => [String(Number(row.character_id)), [Number(row.delta), Number(row.chat_delta)]]);
    return [market.key, Object.fromEntries(comparable)];
  }));
  return {
    captured_at: activity.captured_at,
    baseline_at: activity.baseline_at,
    interval_seconds: seconds,
    markets: compactMarkets
  };
}

const characterHistoryByTime = new Map();
for (const interval of previousActivity?.character_history || []) {
  if (interval?.captured_at && interval?.markets) characterHistoryByTime.set(interval.captured_at, interval);
}
// Migrate the immediately previous detailed interval so this feature starts with
// useful coverage before the next scheduled runs have accumulated a full day.
const previousCharacterInterval = compactCharacterInterval(previousActivity);
if (previousCharacterInterval) characterHistoryByTime.set(previousCharacterInterval.captured_at, previousCharacterInterval);
const currentCharacterInterval = compactCharacterInterval({
  captured_at: capturedAt,
  baseline_at: baselineAt,
  interval_seconds: intervalSeconds,
  markets: activityMarkets
});
if (currentCharacterInterval) characterHistoryByTime.set(currentCharacterInterval.captured_at, currentCharacterInterval);
const characterHistory = [...characterHistoryByTime.values()]
  .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
  .slice(-192);

const activityPayload = {
  captured_at: capturedAt,
  baseline_at: baselineAt,
  interval_seconds: intervalSeconds,
  source_tier: "B",
  definition: "For each site and character ID, current public cumulative counter minus the immediately previous locally stored public catalog snapshot.",
  caveat: "Character hourly rates normalize comparable collection intervals within a rolling 24-hour window. They are public counter changes, not unique users, payments or revenue. New characters without a prior row have null deltas; negative values are retained as source corrections or counter resets.",
  history,
  character_history: characterHistory,
  markets: activityMarkets
};

writeFileSync(path.join(dataDir, "characters.json"), `${JSON.stringify(catalogPayload, null, 2)}\n`, "utf8");
const slimRecords = records.map(({ locale, site, character_id, character_name, work_title, genre, one_line_intro, detailed_intro, custom_world_summary, hashtags, views, chats, local_image, safe_video_url, detail_url, source_id, created_at, start_at, published_at, source_updated_at }) => ({
  locale, site, character_id, character_name, work_title, genre, one_line_intro, detailed_intro, custom_world_summary, hashtags, views, chats, local_image, safe_video_url, detail_url, source_id, created_at, start_at, published_at, source_updated_at
}));
writeFileSync(path.join(dataDir, "characters.js"), `window.TOPTOON_DATA=${JSON.stringify({ generated_at: capturedAt, market_snapshots: catalogPayload.market_snapshots, counts, records: slimRecords })};document.documentElement.dataset.dataReady='true';\n`, "utf8");
writeFileSync(path.join(dataDir, "character-activity.json"), `${JSON.stringify(activityPayload, null, 2)}\n`, "utf8");
writeFileSync(path.join(dataDir, "character-activity.js"), `window.TOPTOON_CHARACTER_ACTIVITY=${JSON.stringify(activityPayload)};\n`, "utf8");
writeFileSync(path.join(dataDir, "official-promotions.json"), `${JSON.stringify(promotionsPayload, null, 2)}\n`, "utf8");
writeFileSync(path.join(dataDir, "official-promotions.js"), `window.TOPTOON_OFFICIAL_PROMOTIONS=${JSON.stringify(promotionsPayload)};\n`, "utf8");
writeFileSync(path.join(dataDir, "official-home-banners.json"), `${JSON.stringify(homeBannersPayload, null, 2)}\n`, "utf8");
writeFileSync(path.join(dataDir, "official-home-banners.js"), `window.TOPTOON_OFFICIAL_HOME_BANNERS=${JSON.stringify(homeBannersPayload)};\n`, "utf8");

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
  character_history_intervals: characterHistory.length,
  promotion_statuses: Object.fromEntries(Object.entries(promotionMarkets).map(([key, value]) => [key, value.status])),
  home_banner_statuses: Object.fromEntries(Object.entries(homeBannerMarkets).map(([key, value]) => [key, value.status])),
  home_banner_counts: Object.fromEntries(Object.entries(homeBannerMarkets).map(([key, value]) => [key, value.items.length])),
  counts,
  downloaded_asset_folders: markets.map((market) => market.key),
  stats_endpoints: Object.keys(statsEndpoints).length
}, null, 2));
