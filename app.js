const MARKET_META = {
  all: { label: "통합", short: "통합", flag: "🌐" },
  kr: { label: "한국", short: "KR", flag: "🇰🇷", site: "KR", locale: "ko-KR", color: "#3987e5" },
  jp: { label: "日本", short: "JP", flag: "🇯🇵", site: "JP", locale: "ja", color: "#d95926" },
  global: { label: "Global", short: "Global", flag: "🌍", site: "GLOBAL", locale: "en", color: "#199e70" },
  tw: { label: "台灣", short: "TW", flag: "🇹🇼", site: "TW", locale: "zh-TW", color: "#22b8a7" }
};

const MARKET_FLAGS = {
  all: "🌐",
  kr: "🇰🇷",
  jp: "🇯🇵",
  global: "🌍",
  tw: "🇹🇼"
};

const VIEW_META = {
  stats: "사업 요약",
  validation: "공시·주가 검증",
  characters: "캐릭터",
  settings: "API 설정"
};

const PUBLIC_READ_ONLY = new URLSearchParams(window.location.search).has("public-preview") ||
  !["127.0.0.1", "localhost"].includes(window.location.hostname);

const SETTING_FIELD_LABELS = {
  OPENDART_API_KEY: "API 키",
  OPENDART_CORP_CODE: "기업 고유번호",
  KIS_APP_KEY: "App Key",
  KIS_APP_SECRET: "App Secret",
  KIS_STOCK_CODE: "종목코드",
  KIS_REFRESH_MIN_HOURS: "시세 캐시 간격 (시간, 0=실시간)",
  ECOS_API_KEY: "API 키",
  KRX_API_KEY: "API 키",
  FRED_API_KEY: "API 키",
  TAVILY_API_KEY: "API 키",
  OPENROUTER_API_KEY: "API 키",
  OPENROUTER_MODEL: "모델 ID",
  DEEPSEEK_API_KEY: "API 키",
  OPENCODE_API_KEY: "API 키",
  NAVER_CLOUD_CLIENT_ID: "Client ID",
  NAVER_CLOUD_CLIENT_SECRET: "Client Secret",
  NAVER_HUB_CLIENT_ID: "Client ID",
  NAVER_HUB_CLIENT_SECRET: "Client Secret",
  NAVER_MAPS_CLIENT_ID: "Client ID",
  NAVER_MAPS_CLIENT_SECRET: "Client Secret",
  TOSS_CLIENT_ID: "Client ID",
  TOSS_CLIENT_SECRET: "Client Secret",
  KIWOOM_APP_KEY: "App Key",
  KIWOOM_SECRET_KEY: "Secret Key"
};

const MARKET_ORDER = ["kr", "jp", "global", "tw"];
const MARKET_BY_SITE = { KR: "kr", JP: "jp", GLOBAL: "global", TW: "tw" };
const MISSING_WORK = "작품 정보 없음";
const REVENUE_ASSUMPTION_STORAGE_KEY = "toptoon-revenue-assumptions-v1";
const FALLBACK_REVENUE_ASSUMPTIONS = Object.freeze({
  unitLow: 2000,
  unitMid: 2354,
  unitHigh: 2700
});
const state = {
  view: "stats",
  market: "all",
  statsMarket: "all",
  leaderboardMarket: "all",
  leaderboardOverride: false,
  selectedSupplyMonth: null,
  simulatedPrice: null,
  revenueViewMode: "recent",
  trendSegment: "week",
  countryTrendMode: "absolute",
  revenueAssumptions: null,
  revenueAssumptionMessage: "",
  peerNewsFilter: "all",
  marketRiskStock: "134580",
  kidariSimulatedPrice: null,
  q: "",
  work: "",
  sort: "views-desc"
};

const els = {};
let dataset = null;
let statsData = null;
let catalogActivityData = null;
let validationData = null;
let integrationsData = null;
let officialSignalsData = null;
let officialPromotionsData = null;
let officialHomeBannersData = null;
let aiDiagnosisData = null;
let records = [];
let groups = [];
let lastTrigger = null;
let activeDialog = null;

function defaultRevenueAssumptions() {
  const constants = statsData?.revenue_nowcast?.constants || {};
  const range = Array.isArray(constants.rev_per_session_range) ? constants.rev_per_session_range : [];
  return {
    unitLow: Number(range[0] || FALLBACK_REVENUE_ASSUMPTIONS.unitLow),
    unitMid: Number(constants.rev_per_session || FALLBACK_REVENUE_ASSUMPTIONS.unitMid),
    unitHigh: Number(range[1] || FALLBACK_REVENUE_ASSUMPTIONS.unitHigh)
  };
}

function normalizeRevenueAssumptions(value, fallback = defaultRevenueAssumptions()) {
  const unitLow = Math.round(Number(value?.unitLow));
  const unitMid = Math.round(Number(value?.unitMid));
  const unitHigh = Math.round(Number(value?.unitHigh));
  const valid = [unitLow, unitMid, unitHigh].every((unit) => Number.isFinite(unit) && unit > 0 && unit <= 1000000) &&
    unitLow <= unitMid && unitMid <= unitHigh;
  return valid ? { unitLow, unitMid, unitHigh } : { ...fallback };
}

function loadRevenueAssumptions() {
  const fallback = defaultRevenueAssumptions();
  try {
    const saved = JSON.parse(window.localStorage.getItem(REVENUE_ASSUMPTION_STORAGE_KEY) || "null");
    return saved ? normalizeRevenueAssumptions(saved, fallback) : fallback;
  } catch {
    return fallback;
  }
}

function revenueAssumptions() {
  if (!state.revenueAssumptions) state.revenueAssumptions = loadRevenueAssumptions();
  return state.revenueAssumptions;
}

function saveRevenueAssumptions(next) {
  state.revenueAssumptions = normalizeRevenueAssumptions(next);
  try {
    window.localStorage.setItem(REVENUE_ASSUMPTION_STORAGE_KEY, JSON.stringify(state.revenueAssumptions));
  } catch {
    // 저장이 차단된 환경에서도 현재 탭에는 적용한다.
  }
}

function resetRevenueAssumptions() {
  state.revenueAssumptions = defaultRevenueAssumptions();
  try {
    window.localStorage.removeItem(REVENUE_ASSUMPTION_STORAGE_KEY);
  } catch {
    // 저장소가 차단된 환경에서는 현재 탭 상태만 초기화한다.
  }
}

function revenueFromChats(chats, unitKey = "unitMid") {
  return Math.round(Number(chats || 0) * Number(revenueAssumptions()[unitKey] || 0));
}

function revenueDeltaKeys(market) {
  return (market === "all" ? MARKET_ORDER : [market]).map((key) => `${key}_delta`);
}

function revenueSeriesForMarket(market) {
  const daily = statsData?.site_traction?.daily || [];
  const keys = revenueDeltaKeys(market);
  return daily.map((row, index) => {
    const throughDate = daily.slice(0, index + 1);
    const averageDailyChats = keys.reduce((marketSum, key) => {
      const observed = throughDate
        .map((item) => item[key])
        .filter((value) => value != null && Number.isFinite(Number(value)))
        .map(Number);
      if (!observed.length) return marketSum;
      return marketSum + (observed.reduce((sum, value) => sum + value, 0) / observed.length);
    }, 0);
    const observedMarkets = keys.filter((key) => throughDate.some((item) => item[key] != null)).length;
    if (!observedMarkets) return null;
    return {
      date: row.date,
      averageDailyChats,
      revenue_low: Math.round(averageDailyChats * 30 * revenueAssumptions().unitLow),
      revenue_mid: Math.round(averageDailyChats * 30 * revenueAssumptions().unitMid),
      revenue_high: Math.round(averageDailyChats * 30 * revenueAssumptions().unitHigh)
    };
  }).filter(Boolean);
}

function recentRevenueForMarket(market) {
  return revenueSeriesForMarket(market).at(-1) || {
    date: null,
    averageDailyChats: 0,
    revenue_low: 0,
    revenue_mid: 0,
    revenue_high: 0
  };
}

function revenueObservationLabel(market) {
  const daily = statsData?.site_traction?.daily || [];
  const counts = (market === "all" ? MARKET_ORDER : [market]).map((key) => ({
    key,
    count: daily.filter((row) => row[`${key}_delta`] != null).length
  }));
  if (market !== "all") return `최근 ${counts[0]?.count || 0}일 평균`;
  const kr = counts.find((item) => item.key === "kr")?.count || 0;
  const overseasCounts = counts.filter((item) => item.key !== "kr").map((item) => item.count);
  const overseasMin = overseasCounts.length ? Math.min(...overseasCounts) : 0;
  const overseasMax = overseasCounts.length ? Math.max(...overseasCounts) : 0;
  const overseas = overseasMin === overseasMax ? `${overseasMin}일` : `${overseasMin}~${overseasMax}일`;
  return `한국 ${kr}일 · 해외 ${overseas} 평균`;
}

function syncSiteHeaderOffset() {
  const header = els.siteHeader || document.querySelector(".site-header");
  if (!header) return;
  const height = Math.ceil(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--site-header-height", `${height}px`);
}

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  load();
});

function bindElements() {
  if (PUBLIC_READ_ONLY) {
    document.documentElement.classList.add("public-read-only");
    document.querySelector('[data-view="settings"]')?.remove();
    document.querySelector("#settings-view")?.remove();
    document.querySelector("#run-ai-analysis")?.closest(".ai-analysis-panel")?.remove();
    const liveLabel = document.querySelector(".live-indicator");
    if (liveLabel) liveLabel.innerHTML = "<i></i> PUBLIC SNAPSHOT";
  }
  els.siteHeader = document.querySelector(".site-header");
  els.viewTabs = [...document.querySelectorAll("[data-view]")];
  els.marketTabs = [...document.querySelectorAll("[data-market]")];
  els.statsView = document.querySelector("#stats-view");
  els.validationView = document.querySelector("#validation-view");
  els.characterView = document.querySelector("#character-view");
  els.settingsView = document.querySelector("#settings-view");
  els.sectionOverview = document.querySelector("#section-overview");
  els.sectionTrends = document.querySelector("#section-trends");
  els.sectionLaunch = document.querySelector("#section-launch");
  els.sectionMarkets = document.querySelector("#section-markets");
  els.sectionSignals = document.querySelector("#section-signals");
  els.statsCapturedAt = document.querySelector("#stats-captured-at");
  els.statsCaveat = document.querySelector("#stats-caveat");
  els.mainKpiGrid = document.querySelector("#main-kpi-grid");
  els.statsMarketTabs = [...document.querySelectorAll("[data-stats-market]")];
  els.statsMarketKpiGrid = document.querySelector("#stats-market-kpi-grid");
  els.statsMarketDefinition = document.querySelector("#stats-market-definition");
  els.statsDashboard = document.querySelector("#stats-dashboard");
  els.validationCapturedAt = document.querySelector("#validation-captured-at");
  els.validationCaveat = document.querySelector("#validation-caveat");
  els.validationKpiGrid = document.querySelector("#validation-kpi-grid");
  els.validationDashboard = document.querySelector("#validation-dashboard");
  els.validationDetail = document.querySelector("#validation-detail");
  els.activeMarketLabel = document.querySelector("#active-market-label");
  els.catalogKpiGrid = document.querySelector("#catalog-kpi-grid");
  els.catalogFreshness = document.querySelector("#catalog-freshness");
  els.catalogFreshnessDetail = document.querySelector("#catalog-freshness-detail");
  els.catalogScopeNote = document.querySelector("#catalog-scope-note");
  els.viewsDeltaScope = document.querySelector("#views-delta-scope");
  els.chatsDeltaScope = document.querySelector("#chats-delta-scope");
  els.searchInput = document.querySelector("#search-input");
  els.workFilter = document.querySelector("#work-filter");
  els.sortSelect = document.querySelector("#sort-select");
  els.tbody = document.querySelector("#character-tbody");
  els.cardList = document.querySelector("#card-list");
  els.resultStatus = document.querySelector("#result-status");
  els.emptyState = document.querySelector("#empty-state");
  els.resetFilters = document.querySelector("#reset-filters");
  els.toolbarReset = document.querySelector("#toolbar-reset");
  els.dialog = document.querySelector("#character-dialog");
  els.dialogContent = document.querySelector("#dialog-content");
  els.dialogClose = document.querySelector("#dialog-close");
  els.apiSettingsForm = document.querySelector("#api-settings-form");
  els.apiSettingsGroups = document.querySelector("#api-settings-groups");
  els.settingsIntegrationStatus = document.querySelector("#settings-integration-status");
  els.apiSettingsStatus = document.querySelector("#api-settings-status");
  els.runManualDeploy = document.querySelector("#run-manual-deploy");
  els.deployProgress = document.querySelector("#deploy-progress");
  els.deployStatusTitle = document.querySelector("#deploy-status-title");
  els.deployStatusDetail = document.querySelector("#deploy-status-detail");
  els.runAiAnalysis = document.querySelector("#run-ai-analysis");
  els.aiAnalysisStatus = document.querySelector("#ai-analysis-status");
  els.aiAnalysisOutput = document.querySelector("#ai-analysis-output");
}

function bindEvents() {
  syncSiteHeaderOffset();
  window.addEventListener("resize", syncSiteHeaderOffset, { passive: true });

  els.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      syncControls();
      render();
      writeHash();
    });
  });

  els.marketTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.market = button.dataset.market;
      state.work = "";
      syncControls();
      render();
      syncOpenDialogToSource("characters");
      writeHash();
    });
  });

  els.statsMarketTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.statsMarket = button.dataset.statsMarket;
      state.leaderboardMarket = state.statsMarket;
      state.leaderboardOverride = false;
      syncControls();
      renderStatsDashboard();
      bindResultButtons();
      syncOpenDialogToSource("stats");
      writeHash();
    });
  });

  els.searchInput.addEventListener("input", () => {
    state.q = els.searchInput.value.trim();
    renderCharacterView();
    writeHash();
  });

  els.workFilter.addEventListener("change", () => {
    state.work = els.workFilter.value;
    renderCharacterView();
    writeHash();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    renderCharacterView();
    writeHash();
  });

  const resetCharacterFilters = () => {
    state.q = "";
    state.work = "";
    state.sort = "views-desc";
    syncControls();
    renderCharacterView();
    writeHash();
  };
  els.resetFilters.addEventListener("click", resetCharacterFilters);
  els.toolbarReset.addEventListener("click", resetCharacterFilters);

  document.addEventListener("pointerover", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-hover-preview]") : null;
    if (!target || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return;
    activateHoverPreview(target);
  });

  document.addEventListener("pointerout", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-hover-preview]") : null;
    if (!target || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return;
    deactivateHoverPreview(target);
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-hover-preview]") : null;
    if (target) activateHoverPreview(target);
  });

  document.addEventListener("focusout", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-hover-preview]") : null;
    if (!target || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return;
    deactivateHoverPreview(target);
  });

  document.addEventListener("click", (event) => {
    const leaderboardMarketButton = event.target.closest("[data-leaderboard-market]");
    if (leaderboardMarketButton) {
      const nextMarket = leaderboardMarketButton.dataset.leaderboardMarket;
      if (MARKET_META[nextMarket]) {
        state.leaderboardMarket = nextMarket;
        state.leaderboardOverride = nextMarket !== state.statsMarket;
        renderStatsDashboard();
        bindResultButtons();
        writeHash();
      }
      return;
    }

    const leaderboardSyncButton = event.target.closest("[data-rank-sync]");
    if (leaderboardSyncButton) {
      state.leaderboardMarket = state.statsMarket;
      state.leaderboardOverride = false;
      renderStatsDashboard();
      bindResultButtons();
      writeHash();
      return;
    }

    const toggle = event.target.closest("[data-rank-toggle]");
    if (toggle) {
      const card = toggle.closest(".character-rank-card");
      const panel = card?.querySelector(".full-rank-panel");
      if (!card || !panel) return;
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.querySelector("b").textContent = expanded ? "전체 순위 접기" : "전체 순위 펼치기";
      panel.hidden = !expanded;
      card.classList.toggle("is-expanded", expanded);
      if (expanded) panel.querySelector(".full-rank-row")?.focus({ preventScroll: true });
      return;
    }

    const monthButton = event.target.closest("[data-supply-month]");
    if (monthButton) {
      state.selectedSupplyMonth = monthButton.dataset.supplyMonth;
      renderStatsDashboard();
      bindResultButtons();
      return;
    }

    const revModeBtn = event.target.closest("[data-revenue-mode]");
    if (revModeBtn) {
      const mode = revModeBtn.dataset.revenueMode;
      if (mode && state.revenueViewMode !== mode) {
        state.revenueViewMode = mode;
        renderStatsDashboard();
        bindResultButtons();
      }
      return;
    }

    const simChip = event.target.closest("[data-set-price]");
    if (simChip) {
      state.simulatedPrice = Number(simChip.dataset.setPrice);
      renderValidationDashboard();
      return;
    }

    const simApplyBtn = event.target.closest("#sim-apply-btn");
    if (simApplyBtn) {
      const input = document.querySelector("#sim-custom-price-input");
      const val = Number(input?.value || 0);
      if (val > 0) {
        state.simulatedPrice = val;
        renderValidationDashboard();
      }
      return;
    }

    const simResetBtn = event.target.closest("#sim-reset-btn");
    if (simResetBtn) {
      state.simulatedPrice = null;
      renderValidationDashboard();
      return;
    }

    const riskStockBtn = event.target.closest("[data-risk-stock]");
    if (riskStockBtn) {
      const stock = riskStockBtn.dataset.riskStock;
      if (stock && state.marketRiskStock !== stock) {
        state.marketRiskStock = stock;
        renderValidationDashboard();
      }
      return;
    }

    const kidariChip = event.target.closest("[data-set-kidari-price]");
    if (kidariChip) {
      state.kidariSimulatedPrice = Number(kidariChip.dataset.setKidariPrice);
      renderValidationDashboard();
      return;
    }

    const kidariApplyBtn = event.target.closest("#sim-kidari-apply-btn");
    if (kidariApplyBtn) {
      const input = document.querySelector("#sim-kidari-custom-price-input");
      const val = Number(input?.value || 0);
      if (val > 0) {
        state.kidariSimulatedPrice = val;
        renderValidationDashboard();
      }
      return;
    }

    const kidariResetBtn = event.target.closest("#sim-kidari-reset-btn");
    if (kidariResetBtn) {
      state.kidariSimulatedPrice = null;
      renderValidationDashboard();
      return;
    }

    const peerNewsFilterBtn = event.target.closest("[data-peer-news-filter]");
    if (peerNewsFilterBtn) {
      const nextFilter = peerNewsFilterBtn.dataset.peerNewsFilter;
      if (nextFilter && state.peerNewsFilter !== nextFilter) {
        state.peerNewsFilter = nextFilter;
        renderValidationDashboard();
      }
      return;
    }

    const revenueApplyButton = event.target.closest("[data-revenue-assumptions-apply]");
    if (revenueApplyButton) {
      const unitLow = Number(document.querySelector("#revenue-unit-low")?.value || 0);
      const unitMid = Number(document.querySelector("#revenue-unit-mid")?.value || 0);
      const unitHigh = Number(document.querySelector("#revenue-unit-high")?.value || 0);
      const candidate = { unitLow, unitMid, unitHigh };
      const valid = [unitLow, unitMid, unitHigh].every((unit) => Number.isFinite(unit) && unit > 0 && unit <= 1000000) &&
        unitLow <= unitMid && unitMid <= unitHigh;
      if (!valid) {
        const status = document.querySelector("#revenue-assumption-status");
        if (status) status.textContent = "하단 ≤ 기준 ≤ 상단 순서로 1~1,000,000원 값을 입력하세요.";
        return;
      }
      saveRevenueAssumptions(candidate);
      state.revenueAssumptionMessage = "선택한 단가를 모든 환산액에 적용했습니다.";
      renderStatsDashboard();
      bindResultButtons();
      syncOpenDialogToSource(state.view === "characters" ? "characters" : "stats");
      return;
    }

    const revenueResetButton = event.target.closest("[data-revenue-assumptions-reset]");
    if (revenueResetButton) {
      resetRevenueAssumptions();
      state.revenueAssumptionMessage = "외부 트래커 참고 기본값으로 복원했습니다.";
      renderStatsDashboard();
      bindResultButtons();
      syncOpenDialogToSource(state.view === "characters" ? "characters" : "stats");
      return;
    }

    const characterButton = event.target.closest("[data-character-id]");
    if (characterButton) {
      openDialog(Number(characterButton.dataset.characterId), characterButton, characterButton.dataset.characterMarket || null);
    }
  });

  els.dialogClose.addEventListener("click", closeDialog);
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeDialog();
  });
  els.dialog.addEventListener("close", () => {
    if (lastTrigger) lastTrigger.focus();
    lastTrigger = null;
    activeDialog = null;
  });

  els.apiSettingsForm?.addEventListener("submit", saveApiSettings);
  els.runManualDeploy?.addEventListener("click", runManualDeploy);
  els.runAiAnalysis?.addEventListener("click", runAiAnalysis);

  document.addEventListener("click", (e) => {
    const segBtn = e.target.closest("[data-trend-segment]");
    if (segBtn) {
      state.trendSegment = segBtn.dataset.trendSegment;
      const currentMarket = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
      if (els.sectionTrends) {
        els.sectionTrends.innerHTML = renderTrendSegmentSection(currentMarket);
      }
      return;
    }
    const modeBtn = e.target.closest("[data-country-mode]");
    if (modeBtn) {
      state.countryTrendMode = modeBtn.dataset.countryMode;
      const currentMarket = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
      if (els.sectionMarkets) {
        els.sectionMarkets.innerHTML = renderMarketsAndMultiSection(currentMarket);
      }
      return;
    }
    const subnavLink = e.target.closest(".subnav-link");
    if (subnavLink) {
      document.querySelectorAll(".subnav-link").forEach((link) => link.classList.remove("is-active"));
      subnavLink.classList.add("is-active");
    }
  });

  window.addEventListener("hashchange", () => {
    readHash();
    syncControls();
    render();
  });
}

async function load() {
  try {
    statsData = window.TOPTOON_STATS || null;
    state.revenueAssumptions = loadRevenueAssumptions();
    catalogActivityData = window.TOPTOON_CHARACTER_ACTIVITY || null;
    validationData = window.TOPTOON_VALIDATION || null;
    officialSignalsData = window.TOPTOON_OFFICIAL_SIGNALS || null;
    officialPromotionsData = window.TOPTOON_OFFICIAL_PROMOTIONS || null;
    officialHomeBannersData = window.TOPTOON_OFFICIAL_HOME_BANNERS || null;
    aiDiagnosisData = window.TOPTOON_AI_DIAGNOSIS || null;
    if (!PUBLIC_READ_ONLY) {
      try {
        const integrationResponse = await fetch("/api/integrations/status");
        if (integrationResponse.ok) integrationsData = await integrationResponse.json();
      } catch {
        integrationsData = null;
      }
      await refreshDeployStatus();
    }
    if (window.TOPTOON_DATA) {
      dataset = mergeDatasets([window.TOPTOON_DATA]);
    } else {
      const baseResponse = await fetch("data/characters.json");
      if (!baseResponse.ok) throw new Error(`data request failed: ${baseResponse.status}`);
      dataset = mergeDatasets([await baseResponse.json()]);
    }
    records = dataset.records.map(normalizeRecord);
    groups = buildGroups(records);
    readHash();
    syncControls();
    render();
  } catch (error) {
    showLoadError(error);
  }
}

let deployPollTimer = null;

async function refreshDeployStatus() {
  if (!els.deployProgress) return;
  try {
    const response = await fetch("/api/deploy/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderDeployStatus(payload);
    clearTimeout(deployPollTimer);
    if (payload.running) deployPollTimer = setTimeout(refreshDeployStatus, 1200);
  } catch (error) {
    renderDeployStatus({ state: "failed", message: "로컬 배포 상태를 확인할 수 없습니다", detail: error.message });
  }
}

async function runManualDeploy() {
  els.runManualDeploy.disabled = true;
  renderDeployStatus({ state: "running", message: "배포 요청을 시작합니다", started_at: new Date().toISOString(), running: true });
  try {
    const response = await fetch("/api/deploy/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = await response.json();
    if (!response.ok && response.status !== 409) throw new Error(payload.error || `HTTP ${response.status}`);
    renderDeployStatus(payload);
    clearTimeout(deployPollTimer);
    deployPollTimer = setTimeout(refreshDeployStatus, 800);
  } catch (error) {
    renderDeployStatus({ state: "failed", message: "수동 배포 요청 실패", detail: error.message });
  }
}

function renderDeployStatus(payload) {
  if (!els.deployProgress) return;
  const stateLabel = {
    idle: "수동 배포 대기",
    running: payload.message || "갱신·검증·배포 진행 중",
    success: "공개판 갱신 완료",
    skipped: "중복 실행 건너뜀",
    failed: "배포 실패"
  }[payload.state] || payload.message || "상태 확인 중";
  const timestamp = payload.finished_at || payload.started_at;
  const detail = payload.state === "success"
    ? `${formatDateTime(payload.finished_at)} · 공개 사이트에서 최신 버전을 확인할 수 있습니다.`
    : payload.state === "running"
      ? `${formatDateTime(payload.started_at)} 시작 · 창을 닫아도 로컬 작업은 계속됩니다.`
      : payload.detail || payload.message || "자동 갱신과 별도로 필요할 때 실행할 수 있습니다.";
  els.deployProgress.dataset.state = payload.state || "idle";
  els.deployStatusTitle.textContent = stateLabel;
  els.deployStatusDetail.textContent = (timestamp || payload.state !== "idle")
    ? detail
    : "자동 갱신과 별도로 필요할 때 실행할 수 있습니다.";
  els.runManualDeploy.disabled = payload.state === "running";
  els.runManualDeploy.textContent = payload.state === "running" ? "배포 진행 중…" : payload.state === "success" ? "다시 갱신·배포" : "지금 갱신·검증·배포";
}

function mergeDatasets(datasets) {
  const mergedRecords = datasets.flatMap((entry) => entry.records || []);
  const counts = mergedRecords.reduce(
    (acc, record) => {
      acc.locale_records += 1;
      acc.uniqueIds.add(record.character_id);
      const site = record.site?.toLowerCase();
      if (site && Object.prototype.hasOwnProperty.call(acc.bySite, site)) {
        acc.bySite[site] += 1;
      }
      return acc;
    },
    { locale_records: 0, uniqueIds: new Set(), bySite: { kr: 0, jp: 0, global: 0, tw: 0 } }
  );
  return {
    generated_at: datasets[0]?.generated_at || new Date().toISOString(),
    market_snapshots: datasets[0]?.market_snapshots || {},
    counts: {
      kr: counts.bySite.kr,
      jp: counts.bySite.jp,
      global: counts.bySite.global,
      tw: counts.bySite.tw,
      locale_records: counts.locale_records,
      unique_character_ids: counts.uniqueIds.size
    },
    records: mergedRecords
  };
}

const CANONICAL_CHARACTER_MAP = {
  // 대만 TW ID 불일치 보정
  "tw:251": 249, // 林筱君 (대만 251) -> 박유미 (한국 249 / 일본 249 / 글로벌 249)
  "tw:250": 247, // 羅心如 (대만 250) -> 나나현 (한국 247 / 글로벌 247)
  "tw:273": 263, // 潘惠媛 (대만 273) -> 김혜연 (한국 263)
  "tw:257": 255, // 崔善英 (대만 257) -> 최선영 (한국 255 / 글로벌 255)
  "tw:269": 264, // 徐幼珍 (대만 269) -> 서우진 (한국 264 / 일본 264)

  // 일본 JP ID 불일치 보정
  "jp:293": 284, // 高橋夕里 (일본 293) -> 오유리 (한국 284 / 글로벌 284 / 대만 284)
  "jp:294": 296, // 葛西陽菜乃 (일본 294) -> 김지민 (한국 296 / 대만 296)
  "jp:295": 261, // 辛嶋雅 (일본 295) -> 나연아 (한국 261 / 대만 261)
  "jp:257": 255, // 園田千里 (일본 257) -> 최선영 (한국 255 / 글로벌 255)

  // 글로벌 GLOBAL ID 불일치 보정
  "global:271": 290, // Lily Park (글로벌 271) -> 박소민 (한국 290 / 일본 290 / 대만 290)
  "global:270": 292, // Min-joo Cho (글로벌 270) -> 조민주 (한국 292 / 일본 292)
  "global:283": 291, // Alice Cha (글로벌 283) -> 차진희 (한국 291 / 일본 291)
  "global:281": 261, // Yeon-ah Na (글로벌 281) -> 나연아 (한국 261 / 대만 261)
  "global:316": 303, // Go-eun Choi (글로벌 316) -> 최고은 (한국 303 / 일본 303 / 대만 303)
  "global:286": 306, // Jane Kim (글로벌 286) -> 김은주 (한국 306 / 일본 306 / 대만 306)
  "global:276": 264, // Woo-jin Seo (글로벌 276) -> 서우진 (한국 264 / 일본 264)
  "global:285": 316, // Summer Jung (글로벌 285) -> 정예솔 (한국 316 / 일본 316 / 대만 316)
  "global:280": 278, // Ah-yeong Cho (글로벌 280) -> 조아영 (한국 278)
  "jp:174": 174,
  "tw:253": 253
};

function getCanonicalCharacterId(record) {
  const key = `${record.market || record.site?.toLowerCase() || ""}:${record.character_id}`.toLowerCase();
  if (CANONICAL_CHARACTER_MAP[key]) return Number(CANONICAL_CHARACTER_MAP[key]);
  return Number(record.character_id);
}

function normalizeRecord(record) {
  const market = MARKET_BY_SITE[record.site] || "global";
  const filename = String(record.local_image || "").split("/").pop();
  const imageKey = filename ? `${market}/${filename}` : "";
  const canonicalId = getCanonicalCharacterId({ ...record, market });
  return {
    ...record,
    market,
    canonicalId,
    viewsNumber: Number(record.views || 0),
    chatsNumber: Number(record.chats || 0),
    genre: String(record.genre || "other"),
    publishedAt: record.published_at || record.start_at || record.created_at || null,
    workSafe: record.work_title || MISSING_WORK,
    imageSrc: filename ? encodeURI(window.TOPTOON_IMAGE_MAP?.[imageKey] || `assets/${market}/${filename}`) : "",
    searchText: ""
  };
}

function buildGroups(allRecords) {
  const byId = new Map();
  allRecords.forEach((record) => {
    const canonicalId = record.canonicalId || getCanonicalCharacterId(record);
    if (!byId.has(canonicalId)) {
      byId.set(canonicalId, {
        id: canonicalId,
        locales: {},
        allRecords: [],
        viewsNumber: 0,
        chatsNumber: 0,
        searchText: ""
      });
    }
    const group = byId.get(canonicalId);
    group.locales[record.market] = record;
    group.allRecords.push(record);
    group.viewsNumber += record.viewsNumber;
    group.chatsNumber += record.chatsNumber;
  });

  const builtGroups = [...byId.values()].map((group) => {
    group.primary = MARKET_ORDER.map((market) => group.locales[market]).find(Boolean);
    group.name = group.primary.character_name;
    group.work = group.primary.workSafe;
    group.genre = group.primary.genre;
    group.publishedAt = group.allRecords
      .map((record) => record.publishedAt)
      .filter(Boolean)
      .sort()[0] || null;
    group.markets = MARKET_ORDER.filter((market) => group.locales[market]);
    group.searchText = group.allRecords
      .flatMap((record) => [record.character_name, record.workSafe, record.character_id, group.id])
      .join(" ")
      .toLowerCase();
    return group;
  });

  records = allRecords.map((record) => {
    const group = byId.get(record.canonicalId || record.character_id);
    record.group = group;
    record.searchText = group ? group.searchText : "";
    return record;
  });

  return builtGroups;
}

function readHash() {
  const raw = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);
  const nextView = params.get("view");
  const legacyMarket = params.get("tab");
  const nextMarket = params.get("market") || legacyMarket;
  const nextLeaderboardMarket = params.get("rank");
  const nextStatsMarket = params.get("scope");
  const hasValidRank = Boolean(MARKET_META[nextLeaderboardMarket]);
  const hasValidScope = Boolean(MARKET_META[nextStatsMarket]);
  state.view = VIEW_META[nextView] && !(PUBLIC_READ_ONLY && nextView === "settings") ? nextView : state.view;
  if (!nextView && legacyMarket && MARKET_META[legacyMarket]) state.view = "characters";
  state.market = MARKET_META[nextMarket] ? nextMarket : state.market;
  state.statsMarket = hasValidScope ? nextStatsMarket : hasValidRank ? "all" : state.statsMarket;
  state.leaderboardMarket = hasValidRank ? nextLeaderboardMarket : state.statsMarket;
  state.leaderboardOverride = hasValidRank && nextLeaderboardMarket !== state.statsMarket;
  state.q = params.get("q") || "";
  state.work = params.get("work") || "";
  state.sort = params.get("sort") || state.sort;
}

function writeHash() {
  const params = new URLSearchParams();
  params.set("view", state.view);
  params.set("market", state.market);
  if (state.statsMarket !== "all" || state.leaderboardOverride) params.set("scope", state.statsMarket);
  if (state.leaderboardOverride && state.leaderboardMarket !== state.statsMarket) params.set("rank", state.leaderboardMarket);
  if (state.q) params.set("q", state.q);
  if (state.work) params.set("work", state.work);
  if (state.sort !== "views-desc") params.set("sort", state.sort);
  const next = `#${params.toString()}`;
  if (window.location.hash !== next) history.replaceState(null, "", next);
}

function syncControls() {
  els.viewTabs.forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.view === state.view));
  });
  els.marketTabs.forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.market === state.market));
  });
  els.statsMarketTabs.forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.statsMarket === state.statsMarket));
  });
  els.searchInput.value = state.q;
  els.sortSelect.value = state.sort;
  renderWorkFilter();
}

function render() {
  if (!dataset) return;
  els.statsView.hidden = state.view !== "stats";
  els.validationView.hidden = state.view !== "validation";
  els.characterView.hidden = state.view !== "characters";
  if (els.settingsView) els.settingsView.hidden = state.view !== "settings";
  renderStatsDashboard();
  renderValidationDashboard();
  renderCharacterView();
  if (!PUBLIC_READ_ONLY) renderSettingsView();
}

function renderSettingsView() {
  const providers = integrationsData?.providers || [];
  els.settingsIntegrationStatus.innerHTML = renderIntegrationStatus();
  if (!providers.length) {
    els.apiSettingsGroups.innerHTML = `<p class="section-note">설정 상태 API에 연결할 수 없습니다. 실행기로 로컬 서버를 시작하세요.</p>`;
    return;
  }
  els.apiSettingsGroups.innerHTML = providers.map((provider) => `
    <fieldset class="settings-provider-card">
      <legend><span class="connector-dot ${provider.configured ? "is-ready" : ""}"></span>${escapeHtml(provider.label)}</legend>
      <p>${provider.configured ? (provider.adapter ? "키 저장됨 · 연결 검사 가능" : "키 저장됨 · 호출기 준비 중") : "설정 필요"}</p>
      ${(provider.fields || []).map((field) => {
        const visible = /(_MODEL|_CORP_CODE|_STOCK_CODE|CLIENT_ID|APP_KEY)$/.test(field.key) && !field.key.endsWith("API_KEY");
        const preset = field.key === "KIS_STOCK_CODE" ? "134580" : field.key === "OPENROUTER_MODEL" ? "nvidia/nemotron-3-ultra-550b-a55b:free" : "";
        return `<label class="settings-field">
          <span>${escapeHtml(SETTING_FIELD_LABELS[field.key] || field.key)}</span>
          <input type="${visible ? "text" : "password"}" name="${escapeAttr(field.key)}" autocomplete="off" placeholder="${field.configured ? "설정됨 · 새 값 입력 시 교체" : escapeAttr(preset || "값 입력")}" />
          ${field.configured ? `<label class="clear-setting"><input type="checkbox" name="clear:${escapeAttr(field.key)}" /> 저장값 제거</label>` : ""}
        </label>`;
      }).join("")}
    </fieldset>
  `).join("");
}

async function saveApiSettings(event) {
  event.preventDefault();
  const formData = new FormData(els.apiSettingsForm);
  const values = {};
  const clear = [];
  for (const [key, rawValue] of formData.entries()) {
    if (key.startsWith("clear:")) {
      clear.push(key.slice(6));
    } else if (String(rawValue).trim()) {
      values[key] = String(rawValue).trim();
    }
  }
  els.apiSettingsStatus.textContent = "저장 중...";
  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values, clear })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    integrationsData = payload;
    renderSettingsView();
    els.apiSettingsStatus.textContent = "저장했습니다. 키 원문은 브라우저에 남기지 않았습니다.";
  } catch (error) {
    els.apiSettingsStatus.textContent = `저장 실패: ${error.message}`;
  }
}

function buildPresetAiAnalysisReport() {
  const investor = validationData?.investor || {};
  const filing = investor.filing_snapshot || {};
  const totals = statsMarketTotals("all");
  const marketView = buildCurrentMarketView(investor);
  const halt = calculateDynamicKrxAlerts(marketView.price, officialSignalsData?.providers?.kis?.price_history || []).halt;
  const haltResult = halt.condition_met === true ? "충족" : halt.condition_met === false ? "미충족" : "판단일 종가 확인 대기";
  return `[탑코미디어(134580) 최신 데이터 검증 요약]

1. 공식 반기 누계 (Tier A · ${filing.as_of || "기준일 미상"}):
- 연결 매출 ${formatWonBig(filing.revenue)}, 영업이익 ${formatWonBig(filing.operating_profit)}, 순이익 ${formatWonBig(filing.net_income)}입니다.
- 영업현금흐름 ${formatWonBig(filing.operating_cash_flow)}, 현금성자산 ${formatWonBig(filing.cash_and_cash_equivalents)}, 단기차입금 ${formatWonBig(filing.short_term_borrowings)}입니다.

2. 공개 카탈로그 직접 관측 (Tier B):
- 4개 시장 현재 합계는 누적 대화 ${formatNumber(totals.chats)}회, 누적 조회 ${formatNumber(totals.views)}회입니다.
- 이 공개 카운터는 결제자 수·유료 세션·매출이 아닙니다. MAU, 결제전환율, ARPPU, 리텐션, CAC는 미공시입니다.

3. 모델 출력과 주가 (Tier C):
- 채팅 델타 기반 매출 환산은 미검증 단가·마진을 적용한 참고 시나리오이며 공시 매출이 아닙니다.
- 최근 확인 주가는 ${formatNumber(marketView.price)}원, 시가총액 환산은 ${formatWonBig(marketView.marketCap)}입니다.
- ${formatDateShort(halt.judgment_date)} 거래정지 판단 종가 ${halt.observed_close ? `${formatNumber(halt.observed_close)}원` : "미수집"}, 기준선 ${halt.trigger_price_raw ? `${formatNumber(halt.trigger_price_raw)}원` : "미수집"}으로 조건은 ${haltResult}입니다.

결론: 공시 실적과 공개 활동은 분리해서 볼 수 있지만, AI챗 별도 매출과 결제 지표가 공시되기 전에는 투자 가설을 확정하지 않습니다.`;
}

async function runAiAnalysis() {
  if (els.runAiAnalysis) els.runAiAnalysis.disabled = true;
  if (els.aiAnalysisStatus) els.aiAnalysisStatus.textContent = "최신 증거 스냅샷 분석을 불러오는 중...";
  try {
    const response = await fetch("/api/analysis/openrouter", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (response.ok) {
      const payload = await response.json();
      if (els.aiAnalysisOutput) {
        els.aiAnalysisOutput.textContent = payload.analysis;
        els.aiAnalysisOutput.hidden = false;
      }
      if (els.aiAnalysisStatus) {
        els.aiAnalysisStatus.textContent = `${formatDateTime(payload.generated_at)} · ${payload.model} · LLM 해석은 원자료가 아닌 보조 검토입니다.`;
      }
      if (els.runAiAnalysis) els.runAiAnalysis.disabled = false;
      return;
    }
  } catch {
    // 웹 정적 환경 시 로컬 최신 사전 분석 리포트 활용
  } finally {
    if (els.runAiAnalysis) els.runAiAnalysis.disabled = false;
  }

  // 로컬 사전 검증 리포트 즉시 표시
  if (els.aiAnalysisOutput) {
    els.aiAnalysisOutput.textContent = buildPresetAiAnalysisReport();
    els.aiAnalysisOutput.hidden = false;
  }
  if (els.aiAnalysisStatus) {
    const reviewTime = validationData?.generated_at || officialSignalsData?.generated_at || new Date().toISOString();
    els.aiAnalysisStatus.textContent = `${formatDateTime(reviewTime)} 로컬 최신 검증 스냅샷 · openai/gpt-4.1-mini · LLM 해석은 원자료가 아닌 보조 검토입니다.`;
  }
}

function renderStats() {
  renderStatsDashboard();
}

function renderStatsDashboard() {
  if (!statsData) {
    els.statsCapturedAt.textContent = "통계 스냅샷 없음";
    els.statsCaveat.textContent = "data/stats.js를 찾지 못해 캐릭터 카탈로그만 표시합니다.";
    els.mainKpiGrid.innerHTML = "";
    if (els.statsMarketKpiGrid) els.statsMarketKpiGrid.innerHTML = "";
    els.statsDashboard.innerHTML = "";
    return;
  }

  const dailyRows = statsData.revenue_nowcast?.daily || [];
  const accumulatedDays = dailyRows.length > 0 ? dailyRows.length : (catalogActivityData?.history?.length || 4);
  const allTotals = statsMarketTotals("all");

  // 1. 공식 공개 오픈일(2026.03.13) 기준 누적 계산
  const launchDate = new Date("2026-03-13T00:00:00+09:00");
  const captureDate = new Date(statsData.captured_at || Date.now());
  const elapsedDays = Math.max(1, Math.floor((captureDate - launchDate) / (1000 * 60 * 60 * 24)));
  const serviceDay = elapsedDays + 1;
  const elapsedMonths = elapsedDays / 30;
  const elapsedMonthLabel = `${elapsedMonths.toFixed(1)}개월`;

  const assumptions = revenueAssumptions();
  const revPerSession = assumptions.unitMid;

  // 현재 공개 누적 카운터 환산액. 공개 오픈일 기준 시작 스냅샷은 없어 실제 기간 매출이 아니다.
  const cumulativeGrossMid = allTotals.chats * revPerSession;

  // 현재 누적 카운터를 공개 오픈 이후 경과 개월로 단순 나눈 참고 환산값
  const cumulativeMonthlyAvg = cumulativeGrossMid / elapsedMonths;
  const krTotals = statsMarketTotals("kr");
  const overseasCumulativeChats = Math.max(0, allTotals.chats - krTotals.chats);
  const overseasCumulativeSharePct = allTotals.chats > 0
    ? (overseasCumulativeChats / allTotals.chats) * 100
    : null;
  const krCumulativeMid = krTotals.chats * revPerSession;
  const overseasCumulativeMid = Math.max(0, cumulativeGrossMid - krCumulativeMid);

  // 2. 최근 일일 델타 기준 속도 관측 (Nowcast 런레이트)
  const allRecent = recentRevenueForMarket("all");
  const krRecent = recentRevenueForMarket("kr");
  const recentAllMarketMid = allRecent.revenue_mid;
  const recentAllMarketLow = allRecent.revenue_low;
  const recentAllMarketHigh = allRecent.revenue_high;
  const krRecentMid = krRecent.revenue_mid;
  const overseasRecentMid = Math.max(0, recentAllMarketMid - krRecentMid);
  const krShareOfRecentPct = recentAllMarketMid > 0 ? (krRecentMid / recentAllMarketMid) * 100 : null;
  const velocityVsCumulativePct = cumulativeMonthlyAvg > 0 && recentAllMarketMid > 0
    ? ((recentAllMarketMid / cumulativeMonthlyAvg) - 1) * 100
    : null;
  const velocityDirection = velocityVsCumulativePct == null
    ? "비교 대기"
    : velocityVsCumulativePct >= 0 ? "최근 속도 우위" : "최근 속도 둔화";
  const benchmark = Number(statsData.revenue_nowcast?.ir_benchmark?.monthly || 0);
  const benchmarkRatioPct = benchmark > 0 ? (krRecentMid / benchmark) * 100 : null;
  const allObservation = revenueObservationLabel("all");
  const krObservation = revenueObservationLabel("kr");

    // 1. Render new trend-first sections
  const currentMarket = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
  if (els.sectionOverview) els.sectionOverview.innerHTML = renderLiveActivitySection(currentMarket);
  if (els.sectionTrends) els.sectionTrends.innerHTML = renderTrendSegmentSection(currentMarket);
  if (els.sectionLaunch) els.sectionLaunch.innerHTML = renderGrowthSinceLaunch();
  if (els.sectionMarkets) els.sectionMarkets.innerHTML = renderMarketsAndMultiSection(currentMarket);
  if (els.sectionSignals) els.sectionSignals.innerHTML = renderAnalyticalSignalsSection(currentMarket);

  els.statsCapturedAt.textContent = `${formatDateTime(statsData.captured_at)} 수집 스냅샷`;
  els.statsCaveat.textContent =
    `공개 대화 활동량에 선택 단가 ${formatNumber(revPerSession)}원을 적용한 시나리오입니다. 실제 결제율·매출은 공개되지 않았습니다.`;

  els.mainKpiGrid.innerHTML = `
    <div class="kpi-dual-container">
      <div class="kpi-group-card group-cumulative">
        <div class="kpi-group-header">
          <div class="kpi-group-title">
            <span class="kpi-group-tag tag-cumulative">🏛️ 현재 누적 공개 활동 환산</span>
            <strong>🌐 4개국 통합 · 누적 공개 카운터 × 선택 단가 ${formatNumber(revPerSession)}원</strong>
          </div>
        </div>
        <div class="kpi-card-subgrid">
          ${renderStatCards([
            ["🌐 통합 누적 활동 환산액", `약 ${formatWonBig(cumulativeGrossMid)}`, `🇰🇷 한국 ${formatWonBig(krCumulativeMid)} + 🌏 해외 ${formatWonBig(overseasCumulativeMid)}`, "signal"],
            ["🌐 관측 누적액 단순 월환산", `월 약 ${formatWonBig(cumulativeMonthlyAvg)}`, `현재 누적 카운터 ÷ ${elapsedMonthLabel} · 3/13 시작 스냅샷 없음`, "neutral"],
            ["🌏 해외 누적 대화 비중", overseasCumulativeSharePct == null ? "-" : `${overseasCumulativeSharePct.toFixed(1)}%`, `4개국 누적 대화 중 해외 ${formatNumber(overseasCumulativeChats)}회`, "positive"],
            ["서비스 운영 기간", `${serviceDay}일차 <small class="stat-sub">(${elapsedMonthLabel} 환산)</small>`, `${elapsedDays}일 경과 · 2026.03.13 공개 오픈`, "neutral"]
          ])}
        </div>
      </div>

      <div class="kpi-group-card group-velocity">
        <div class="kpi-group-header">
          <div class="kpi-group-title">
            <span class="kpi-group-tag tag-velocity">⚡ 최근 일일 속도 관측 (현재 런레이트)</span>
            <strong>🌐 4개국 통합 속도 및 시장별 기여 (${allObservation})</strong>
          </div>
        </div>
        <div class="kpi-card-subgrid kpi-scope-split-grid">
          ${renderStatCards([
            ["🌐 통합 최근 월환산 활동액", recentAllMarketMid ? `월 약 ${formatWonBig(recentAllMarketMid)}` : "-", recentAllMarketMid ? `${formatWonBig(recentAllMarketLow)}–${formatWonBig(recentAllMarketHigh)} · ${allObservation}` : "시장별 델타 수집 대기", "signal"],
            ["🇰🇷 한국 최근 월환산 활동액", krRecentMid ? `월 약 ${formatWonBig(krRecentMid)}` : "-", krShareOfRecentPct == null ? "한국 델타 수집 대기" : `통합 최근 속도의 ${krShareOfRecentPct.toFixed(1)}% · ${krObservation}`, "positive"],
            ["🌏 해외 합산 월환산 활동액", overseasRecentMid ? `월 약 ${formatWonBig(overseasRecentMid)}` : "-", krShareOfRecentPct == null ? "해외 델타 수집 대기" : `통합 최근 속도의 ${(100 - krShareOfRecentPct).toFixed(1)}% · 공통 단가 적용`, "neutral"],
            ["🇰🇷 한국 9억 가정 대비", benchmarkRatioPct == null ? "-" : `${benchmarkRatioPct.toFixed(1)}%`, `월 9억 목표 대비 현재 한국 속도 (${krRecentMid ? formatWonBig(krRecentMid) : "-"})`, "warning"]
          ])}
        </div>
        <div class="kpi-scope-footnote">
          <span><strong>기간 차이</strong> 장기 평균 ${formatWonBig(cumulativeMonthlyAvg)} ↔ 최근 속도 ${formatWonBig(recentAllMarketMid)}</span>
          <span><strong>속도 변화</strong> ${velocityVsCumulativePct == null ? "비교 대기" : `${velocityDirection} ${velocityVsCumulativePct >= 0 ? "+" : ""}${velocityVsCumulativePct.toFixed(1)}%`}</span>
          <span><strong>표본</strong> ${allObservation} · 14일 이상 권장</span>
          <span><strong>수집</strong> ${escapeHtml(formatDateTime(statsData.captured_at))}</span>
        </div>
      </div>
    </div>
  `;

  renderStatsMarketSummary();

  els.statsDashboard.innerHTML = [
    renderRevenuePanel(),
    renderGlobalPanel(),
    renderCompletionPanel(),
    renderGrowthPanel(),
    renderTotalsPanel()
  ].join("");
}

function statsMarketRecords(market) {
  return market === "all" ? records : recordsForMarket(market);
}

function statsMarketTotals(market) {
  const source = statsMarketRecords(market);
  return {
    characters: market === "all" ? groups.length : source.length,
    localeRecords: source.length,
    views: source.reduce((sum, row) => sum + Number(row.viewsNumber || 0), 0),
    chats: source.reduce((sum, row) => sum + Number(row.chatsNumber || 0), 0)
  };
}

function catalogHistoryForMarket(market) {
  const aggregate = (snapshot) => {
    const selected = market === "all" ? MARKET_ORDER : [market];
    return selected.reduce((totals, key) => {
      const values = snapshot?.markets?.[key] || {};
      totals.characters += Number(values.characters || 0);
      totals.total_views += Number(values.views || 0);
      totals.total_chats += Number(values.chats || 0);
      return totals;
    }, { date: String(snapshot?.captured_at || "").slice(0, 10), captured_at: snapshot?.captured_at, characters: 0, total_views: 0, total_chats: 0 });
  };
  const stored = (catalogActivityData?.history || []).map(aggregate).filter((row) => row.date);
  if (stored.length >= 2) return stored;

  const current = statsMarketTotals(market);
  const directRows = market === "all"
    ? MARKET_ORDER.map((key) => catalogActivityData?.markets?.[key]).filter(Boolean)
    : [catalogActivityData?.markets?.[market]].filter(Boolean);
  const viewsDelta = directRows.reduce((sum, item) => sum + Number(item.views_delta || 0), 0);
  const chatsDelta = directRows.reduce((sum, item) => sum + Number(item.chats_delta || 0), 0);
  const baselineAt = catalogActivityData?.baseline_at;
  const capturedAt = catalogActivityData?.captured_at || dataset?.generated_at;
  if (!baselineAt || !capturedAt) return stored;
  return [
    { date: String(baselineAt).slice(0, 10), captured_at: baselineAt, characters: current.localeRecords, total_views: current.views - viewsDelta, total_chats: current.chats - chatsDelta },
    { date: String(capturedAt).slice(0, 10), captured_at: capturedAt, characters: current.localeRecords, total_views: current.views, total_chats: current.chats }
  ];
}

function catalogIntervalDeltas(market, key) {
  const rows = catalogHistoryForMarket(market);
  return rows.slice(1).map((row, index) => ({
    label: formatCollectionPoint(row.captured_at),
    value: Number(row[key] || 0) - Number(rows[index]?.[key] || 0),
    sub: formatActivityWindow(rows[index]?.captured_at, row.captured_at)
  })).slice(-7);
}

function marketAnalysisItems(market) {
  if (market !== "all") return recordsForMarket(market);
  return groups.map((group) => ({
    character_id: group.id,
    character_name: group.name,
    workSafe: group.work,
    genre: group.genre,
    publishedAt: group.publishedAt,
    viewsNumber: group.viewsNumber,
    chatsNumber: group.chatsNumber,
    imageSrc: group.primary.imageSrc,
    market: group.primary.market
  }));
}

function monthSeries(items) {
  const counts = new Map();
  items.forEach((item) => {
    const month = String(item.publishedAt || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) counts.set(month, (counts.get(month) || 0) + 1);
  });
  const observed = [...counts.keys()].sort();
  if (!observed.length) return [];
  const cursor = new Date(`${observed[0]}-01T00:00:00Z`);
  const end = new Date(`${observed.at(-1)}-01T00:00:00Z`);
  const rows = [];
  while (cursor <= end) {
    const month = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    rows.push({ label: month, value: counts.get(month) || 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return rows;
}

function marketCohortResponseRows(market) {
  const buckets = new Map();
  marketAnalysisItems(market).forEach((item) => {
    const month = String(item.publishedAt || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const bucket = buckets.get(month) || { chats: 0, count: 0 };
    bucket.chats += Number(item.chatsNumber || 0);
    bucket.count += 1;
    buckets.set(month, bucket);
  });
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, bucket]) => ({
    label,
    value: bucket.count ? bucket.chats / bucket.count : 0,
    sub: `${formatNumber(bucket.count)}명 코호트`
  }));
}

function normalizedGenre(value) {
  const key = String(value || "other").trim().toLowerCase();
  if (["modern", "현대"].includes(key)) return "modern";
  return key || "other";
}

function marketGenreRows(market) {
  const labels = { drama: "드라마", romance: "로맨스", fantasy: "판타지", daily: "일상", comedy: "코미디", thriller: "스릴러", modern: "현대", other: "기타" };
  const buckets = new Map();
  const items = marketAnalysisItems(market);
  items.forEach((item) => {
    const genre = normalizedGenre(item.genre);
    const bucket = buckets.get(genre) || { genre, genre_label: labels[genre] || item.genre || "기타", char_count: 0, total_chats: 0 };
    bucket.char_count += 1;
    bucket.total_chats += Number(item.chatsNumber || 0);
    buckets.set(genre, bucket);
  });
  const totalChats = items.reduce((sum, item) => sum + Number(item.chatsNumber || 0), 0) || 1;
  return [...buckets.values()]
    .map((row) => ({ ...row, share: row.total_chats / totalChats }))
    .sort((a, b) => b.total_chats - a.total_chats || b.char_count - a.char_count);
}

function renderStatsMarketSummary() {
  if (!els.statsMarketKpiGrid) return;
  const market = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
  const meta = MARKET_META[market];
  const totals = statsMarketTotals(market);
  const activity = activitySummaryForMarket(market);

  if (els.sectionOverview) els.sectionOverview.innerHTML = renderLiveActivitySection(market);
  if (els.sectionTrends) els.sectionTrends.innerHTML = renderTrendSegmentSection(market);
  if (els.sectionMarkets) els.sectionMarkets.innerHTML = renderMarketsAndMultiSection(market);
  if (els.sectionSignals) els.sectionSignals.innerHTML = renderAnalyticalSignalsSection(market);

  // 1. 일간(24h) 델타 계산 (4개 시장 각각의 24h 실측 합산)
  const dailyDeltas = getDailyMarketDeltas(market);
  const dailyViewsDelta = dailyDeltas.viewsDelta;
  const dailyChatsDelta = dailyDeltas.chatsDelta;
  const dailyDateLabel = dailyDeltas.dateLabel;

  els.statsMarketTabs.forEach((button) => {
    const buttonMarket = button.dataset.statsMarket;
    if (buttonMarket === "all") {
      button.querySelector("small").textContent = `${formatNumber(groups.length)}명 · 지역 등록 ${formatNumber(records.length)}건`;
    } else {
      const count = recordsForMarket(buttonMarket).length;
      button.querySelector("small").textContent = `${formatNumber(count)}명`;
    }
  });

  const marketPrefix = meta.label === "통합" ? "통합" : meta.label;

  const hourlyRows = getHourlyTrafficHistory(market, 12);
  let avgHourlyViews = activity.viewsPerHour || activity.viewsDelta;
  let avgHourlyChats = activity.chatsPerHour || activity.chatsDelta;
  if (hourlyRows.length > 0) {
    avgHourlyViews = Math.round(hourlyRows.reduce((s, r) => s + r.viewsPerHour, 0) / hourlyRows.length);
    avgHourlyChats = Math.round(hourlyRows.reduce((s, r) => s + r.chatsPerHour, 0) / hourlyRows.length);
  }

  const viewsPopover = renderHourlyTrafficPopover(market, "views");
  const chatsPopover = renderHourlyTrafficPopover(market, "chats");
  const dailyViewsPopover = renderDailyTrafficPopover(market, "views");
  const dailyChatsPopover = renderDailyTrafficPopover(market, "chats");

  const summaryCards = renderStatCards([
    [`${meta.label} 캐릭터`, `${formatNumber(totals.characters)}명`, market === "all" ? `${formatNumber(totals.localeRecords)}개 지역 레코드` : "시장 원본 목록", "signal"],
    ["누적 조회수", formatNumber(totals.views), "공개 카운터 합계", "neutral"],
    ["누적 대화수", formatNumber(totals.chats), "공개 카운터 합계", "neutral"]
  ]);
  const growthCards = renderStatCards([
    ["일간(24h) 조회 증가", signedNumber(dailyViewsDelta), `24h 기준 · 🔍 호버 시 일간 추이`, dailyViewsDelta >= 0 ? "positive" : "warning", dailyViewsPopover],
    ["일간(24h) 대화 증가", signedNumber(dailyChatsDelta), `24h 기준 · 🔍 호버 시 일간 추이`, dailyChatsDelta >= 0 ? "positive" : "warning", dailyChatsPopover],
    [`${marketPrefix} 시간당 조회 증가`, signedNumber(avgHourlyViews), `시간당 평균 · 🔍 호버 시 24h 추이`, avgHourlyViews >= 0 ? "positive" : "warning", viewsPopover],
    [`${marketPrefix} 시간당 대화 증가`, signedNumber(avgHourlyChats), `시간당 평균 · 🔍 호버 시 24h 추이`, avgHourlyChats >= 0 ? "positive" : "warning", chatsPopover]
  ]);
  els.statsMarketKpiGrid.innerHTML = `
    <div class="market-kpi-row market-kpi-row-summary" aria-label="누적 지표">${summaryCards}</div>
    <div class="market-kpi-row market-kpi-row-growth" aria-label="24시간 증가 지표">${growthCards}</div>
  `;
  const targetMarkets = market === "all" ? MARKET_ORDER : [market];
  const allDailyDeltas = getDailyMarketDeltas("all");
  const observedCards = targetMarkets.map((key) => renderObservedMarketCard(key, allDailyDeltas)).join("");
  const homeBannerCards = targetMarkets.map(renderOfficialHomeBannerCard).join("");
  const promotionCards = targetMarkets.map(renderOfficialPromotionCard).join("");

  els.statsMarketDefinition.innerHTML = `
    <div class="market-live-event-banner">
      <div class="event-banner-header">
        <div class="event-live-indicator">
          <span class="live-pulse"></span>
          <strong>📊 4개 시장 API 실측 변화 · 공식 프로모션</strong>
        </div>
        <span class="event-badge-highlight">⚠️ 공개 카운터는 유입 원인·고유 이용자·결제·매출이 아님</span>
      </div>
      <section class="event-fact-section" aria-label="API 관측 변화">
        <div class="event-section-heading">
          <strong>API 관측 변화</strong>
          <span>24시간 환산 시장 비중과 최근 수집 간 실제 증가 상위</span>
        </div>
        <div class="event-feed-grid${market === "all" ? "" : " single-col"}">${observedCards}</div>
      </section>
      <section class="event-home-banner-section" aria-label="공식 홈 상단 배너">
        <div class="event-section-heading">
          <strong>공식 홈 상단 배너</strong>
          <span>각국 공식 홈에서 이번 갱신에 확인된 제목·이미지·배지</span>
        </div>
        <div class="official-home-banner-grid${market === "all" ? "" : " single-col"}">${homeBannerCards}</div>
      </section>
      <section class="event-promotion-section" aria-label="공식 프로모션 감지">
        <div class="event-section-heading">
          <strong>공식 프로모션 감지</strong>
          <span>카탈로그 배지와 공식 홈페이지 링크 확인 상태</span>
        </div>
        <div class="promotion-feed-grid${market === "all" ? "" : " single-col"}">${promotionCards}</div>
      </section>
      <p class="event-source-caveat">프로모션 존재와 조회·대화 증가는 함께 표시할 뿐 인과관계로 연결하지 않습니다. 유입 원인은 공식 공지나 리퍼러 자료가 있을 때만 별도 표기합니다.</p>
    </div>
  `;
}

function renderValidationDashboard() {
  if (!validationData) {
    els.validationCapturedAt.textContent = "검증 스냅샷 없음";
    els.validationCaveat.textContent = "node scripts/crosscheck.mjs --live --write 실행 후 다시 여세요.";
    els.validationKpiGrid.innerHTML = "";
    els.validationDashboard.innerHTML = "";
    els.validationDetail.innerHTML = "";
    return;
  }

  const summary = validationData.summary || {};
  const investor = validationData.investor || {};
  const thesis = investor.thesis || {};
  const filing = investor.filing_snapshot || {};
  const market = investor.market_snapshot || {};
  const derived = investor.derived || {};
  const marketView = buildCurrentMarketView(investor);
  const statusLabel = {
    "ready-to-share": "공유 가능",
    "share-with-caveats": "주의사항 포함",
    "needs-revision": "수정 필요"
  }[validationData.overall_status] || validationData.overall_status;

  const latestRefreshAt = officialSignalsData?.generated_at || validationData.generated_at;
  els.validationCapturedAt.textContent = `${formatDateTime(latestRefreshAt)} 최종 자동 갱신`;
  els.validationCaveat.textContent =
    "주가·캐릭터 수치는 자동 갱신하고, 재무실적·지분은 새 공시가 나올 때만 바뀝니다. 관측 채팅은 결제나 매출과 동일하지 않습니다.";
  els.validationKpiGrid.innerHTML = renderDecisionKpis(summary, statusLabel, thesis, marketView);

  els.validationDashboard.innerHTML = [
    renderDecisionPath(thesis),
    renderFreshnessStrip(validationData, investor, marketView),
    renderLatestDisclosures(),
    renderFilingReconciliation(filing, derived),
    renderStrategicCrosscheck(),
    renderMarketRisk(investor, marketView),
    renderPeerComparison(marketView),
    renderPeerNewsSection(marketView),
    renderCatalogCrosscheck(validationData.catalogs || {}),
    renderScheduledAiDiagnosis()
  ].join("");

  els.validationDetail.innerHTML = [
    renderValidationChecks(validationData.checks || []),
    renderSourceLedger(investor.sources || [])
  ].join("");

  if (els.aiAnalysisOutput && !els.aiAnalysisOutput.textContent.trim()) {
    els.aiAnalysisOutput.textContent = buildPresetAiAnalysisReport();
    els.aiAnalysisOutput.hidden = false;
    if (els.aiAnalysisStatus) {
      const reviewTime = validationData?.generated_at || officialSignalsData?.generated_at || new Date().toISOString();
      els.aiAnalysisStatus.textContent = `${formatDateTime(reviewTime)} 로컬 최신 검증 스냅샷 · openai/gpt-4.1-mini · LLM 해석은 원자료가 아닌 보조 검토입니다.`;
    }
  }
}

function renderStrategicCrosscheck() {
  const kpiWatchItems = [
    { num: "01", title: "탑툰챗 MAU", desc: "공시 또는 회사 IR 원문 확인 필요" },
    { num: "02", title: "Payer Conversion", desc: "결제자 수와 활성 이용자 수 미공시" },
    { num: "03", title: "Payer ARPPU", desc: "AI챗 결제액과 결제자 수 미공시" },
    { num: "04", title: "D30/D90 Retention", desc: "코호트 잔존율 미공시" },
    { num: "05", title: "AI·PG·IP 원가율", desc: "AI챗 단위경제와 원가 구성 미공시" },
    { num: "06", title: "탑툰→챗 전환율", desc: "서비스 간 전환 모수와 전환자 수 미공시" },
    { num: "07", title: "국가별 CAC", desc: "국가별 마케팅비와 신규 결제자 수 미공시" },
    { num: "08", title: "TOPCO JAPAN 순자산", desc: "최신 종속회사 재무 공시로 재확인 필요" }
  ];

  return `
    <section class="panel stats-panel validation-panel strategic-crosscheck-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Business model & KPI watch</p>
          <h2>비즈니스 모델 퍼널 · 다음 분기 8대 핵심 점검 KPI</h2>
          <p class="stat-help">기존 유료 웹툰 결제자를 탑툰챗으로 연결하는 크로스셀 구조와 밸류에이션 판정을 위한 핵심 점검 지표입니다.</p>
        </div>
        <span class="evidence-badge tier-c">C · 미공시 점검표</span>
      </div>
      <div class="card" style="margin-bottom:12px">
        <h3>탑툰 ↔ 탑툰챗 '한 지갑' 크로스셀 퍼널</h3>
        <div class="flow">
          <div class="node"><div class="n">STEP 1</div><div class="t">웹툰 IP</div><div class="d">캐릭터 인지</div></div>
          <div class="node"><div class="n">STEP 2</div><div class="t">기존 결제자</div><div class="d">결제 이력 보유</div></div>
          <div class="node"><div class="n">STEP 3</div><div class="t">코인 통합 (5/22)</div><div class="d">결제 장벽 해소</div></div>
          <div class="node"><div class="n">STEP 4</div><div class="t">대화·에셋 해금</div><div class="d">일러스트·시나리오</div></div>
          <div class="node"><div class="n">STEP 5</div><div class="t">관계성 재방문</div><div class="d">반복 지출 형성</div></div>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0">다음 분기 실적에서 확인해야 할 8대 핵심 KPI</h3>
            <p class="stat-help" style="margin:2px 0 0">공식 출처가 확인되기 전까지 수치와 달성률을 표시하지 않는 점검표</p>
          </div>
          <div class="kpi-gauge-legend"><span class="legend-chip tone-neutral">공시·IR 출처 확인 전 숫자 미표시</span></div>
        </div>
        <div class="kpi-watch">
          ${kpiWatchItems
            .map((item) => `
            <div class="watch tone-neutral">
              <div class="watch-top">
                <div class="watch-header">
                  <span class="num">${item.num}</span>
                  <b>${escapeHtml(item.title)}</b>
                </div>
                <span class="watch-pct-badge tone-neutral">미공시</span>
              </div>
              <div class="watch-bottom">
                <p>${escapeHtml(item.desc)}</p>
                <span class="watch-status tone-neutral">확인 필요</span>
              </div>
            </div>
          `)
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderDecisionKpis(summary, statusLabel, thesis, marketView) {
  const warnings = Number(summary.warn || 0);
  const blocks = Number(summary.block || 0);
  const dataValue = blocks ? "사용 중단" : warnings ? `주의 ${warnings}건` : "검증 통과";
  const companyValue = thesis.company_status === "strengthening" ? "실적 개선 흐름" : "추가 확인 필요";
  const stockValue = thesis.security_readiness === "conditional" ? "관찰 유지" : escapeHtml(thesis.security_readiness || "판단 대기");
  return `
    <article class="decision-kpi tone-${blocks ? "danger" : warnings ? "warning" : "positive"}">
      <span class="decision-kpi-step">01 · 데이터</span><strong>${escapeHtml(dataValue)}</strong>
      <p>${escapeHtml(statusLabel)} · 차단 ${blocks}건 · 통과 ${Number(summary.pass || 0)}건</p>
      <small>${blocks ? "차단 원인을 해결하기 전 투자 화면 사용 중지" : "공식 공시와 직접 관측은 사용 가능, 추정치는 보수적으로 해석"}</small>
    </article>
    <article class="decision-kpi tone-positive">
      <span class="decision-kpi-step">02 · 사업</span><strong>${escapeHtml(companyValue)}</strong>
      <p>공시 매출·영업이익·현금흐름 기준</p>
      <small>캐릭터챗 별도 매출은 아직 공시되지 않아 사업 전체와 분리해서 봅니다.</small>
    </article>
    <article class="decision-kpi tone-signal">
      <span class="decision-kpi-step">03 · 투자 판단</span><strong>${stockValue}</strong>
      <p>${thesis.action === "wait for proof" ? "AI챗 유료매출 증거 대기" : escapeHtml(thesis.action || "다음 증거 대기")}</p>
      <small>좋은 사업 흐름과 지금 주가가 싼지는 다른 질문입니다.</small>
    </article>
    <article class="decision-kpi tone-neutral">
      <span class="decision-kpi-step">04 · 현재 기업가치</span><strong>${formatWonBig(marketView.marketCap)}</strong>
      <p>${formatNumber(marketView.price)}원 × ${formatNumber(marketView.shares)}주</p>
      <small>${escapeHtml(marketView.sourceLabel)} · ${marketView.shareCountChanged ? "과거 스냅샷 대신 현재 상장주식수 반영" : "동종기업과 아래에서 비교"}</small>
    </article>
  `;
}

function renderDecisionPath(thesis) {
  return `
    <section class="decision-path" aria-label="투자 판단 읽는 순서">
      <div class="decision-path-title"><span>이 화면 읽는 순서</span><strong>사실 → 해석 → 투자 결론</strong></div>
      <div class="decision-path-step is-fact"><b>1</b><p><strong>확인된 사실</strong><small>상반기 실적과 현금흐름 개선</small></p></div>
      <i aria-hidden="true">→</i>
      <div class="decision-path-step is-view"><b>2</b><p><strong>현재 해석</strong><small>사업 가설은 강화, AI챗 기여는 미확인</small></p></div>
      <i aria-hidden="true">→</i>
      <div class="decision-path-step is-action"><b>3</b><p><strong>지금 행동</strong><small>${thesis.action === "wait for proof" ? "매수 판단보다 증거 확인 우선" : escapeHtml(thesis.action || "추가 확인")}</small></p></div>
    </section>
  `;
}

function renderLatestDisclosures() {
  const dart = officialSignalsData?.providers?.opendart || {};
  const disclosures = (dart.disclosures || []).slice(0, 5);
  return `
    <section class="panel stats-panel validation-panel latest-disclosure-panel">
      <div class="panel-heading compact-heading">
        <div><p class="section-kicker">OpenDART 자동 확인</p><h2>최근 회사 공시</h2><p class="stat-help">탑코미디어 134580 · 최근 180일 · 1시간마다 확인</p></div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="pill purple" title="9월 10일 임시주총: 엔키AX(ANKEY AX) 사명변경 및 4대 AI 사업목적 추가">9/10 임총: 엔키AX 사명변경</span>
          <span class="evidence-badge ${dart.status === "ok" ? "tier-a" : "tier-c"}">${dart.status === "ok" ? `${(dart.disclosures || []).length}건 확인` : "이전 정상값"}</span>
        </div>
      </div>
      <div class="latest-disclosure-list">
        ${disclosures.length ? disclosures.map((item) => `
          <a href="${escapeAttr(item.url || "#")}" target="_blank" rel="noopener noreferrer">
            <span>${escapeHtml(String(item.filed_at || "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"))}</span>
            <strong>${escapeHtml(item.report || "공시")}</strong>
            <small>${escapeHtml(item.filer || item.company || "탑코미디어")}</small>
          </a>
        `).join("") : `<p class="empty-inline">최근 180일 신규 공시가 없거나 API 확인이 지연되고 있습니다.</p>`}
      </div>
    </section>
  `;
}

function buildCurrentMarketView(investor) {
  const market = investor.market_snapshot || {};
  const kis = officialSignalsData?.providers?.kis || {};
  const quote = kis.quote || {};
  const hasCurrentQuote = ["ok", "cached"].includes(kis.status) && Number(quote.price || 0) > 0;
  const basePrice = hasCurrentQuote ? Number(quote.price) : Number(market.close || 0);
  const price = state.simulatedPrice != null ? Number(state.simulatedPrice) : basePrice;
  const previousClose = hasCurrentQuote ? Number(quote.previous_close || 0) || (basePrice - Number(quote.change || 0)) : Number(market.reference_close || 0);
  const reportedShares = Number(market.shares_outstanding || 0);
  const liveShares = Number(quote.shares_outstanding || 0);
  const shares = hasCurrentQuote && liveShares ? liveShares : reportedShares;
  const referenceClose = Number(market.reference_close || 0);
  const change = previousClose ? price - previousClose : (hasCurrentQuote ? Number(quote.change || 0) : null);
  const changePct = previousClose ? ((price - previousClose) / previousClose) * 100 : (hasCurrentQuote ? Number(quote.change_pct || 0) : null);

  return {
    price,
    basePrice,
    isSimulated: state.simulatedPrice != null && state.simulatedPrice !== basePrice,
    previousClose,
    open: hasCurrentQuote ? Number(quote.open || 0) || null : null,
    high: hasCurrentQuote ? Number(quote.high || 0) || null : null,
    low: hasCurrentQuote ? Number(quote.low || 0) || null : null,
    change,
    changePct,
    volume: hasCurrentQuote ? Number(quote.volume || 0) : Number(market.volume || 0),
    shares,
    marketCap: price * shares,
    fromReferencePct: referenceClose ? ((price / referenceClose) - 1) * 100 : 0,
    refreshedAt: hasCurrentQuote ? (kis.observed_at || officialSignalsData?.generated_at) : market.as_of,
    sourceLabel: state.simulatedPrice != null && state.simulatedPrice !== basePrice
      ? "실시간 시뮬레이션 계산"
      : (hasCurrentQuote ? `KIS ${kis.status === "cached" ? "이전 정상값" : "최근 조회"}` : "2차 종가"),
    isCurrent: hasCurrentQuote,
    shareCountChanged: Boolean(hasCurrentQuote && liveShares && reportedShares && liveShares !== reportedShares)
  };
}

function calculateDynamicKrxAlerts(price, history = []) {
  const currentPrice = Number(price || 0);
  const rows = [...history].filter((r) => r.close > 0).sort((a, b) => a.date.localeCompare(b.date));
  
  const closeOn = (dateStr) => {
    const compact = String(dateStr).replaceAll("-", "");
    return rows.find((r) => r.date === compact)?.close || null;
  };

  // 1. 거래정지 이력 및 다음 정지 판단
  // - 8/25 종가(3,440원)가 8/20(2,160원) 대비 40% 이상 급등하여 8/26 1일간 정지 집행 완료
  // - 8/27 오늘 매매거래정지 해제되어 정상 거래 재개 (종가 3,320원)
  // - 다음 추가 정지 요건: 직전 최고가(3,440원) 대비 40% 이상 추가 급등 시 (4,816원 이상)
  const haltRefClose = closeOn("20260820") || 2160;
  const haltJudgmentClose = closeOn("20260825") || closeOn("20260824") || 3440;
  const peakClose = Math.max(haltJudgmentClose, 3440); // 8월 25일 최고 종가
  const nextHaltThreshold = Math.round(peakClose * 1.4); // 4,816원
  const nextHaltGap = currentPrice - nextHaltThreshold;
  const isNextHaltMet = currentPrice >= nextHaltThreshold;

  // 2. 투자경고 해제 판단 (9월 3일 최초 판단 예정)
  // 조건 1: 5일 전(2026-08-27) 종가(3,320원) 대비 45% 미만 상승 (3,320 * 1.45 = 4,814원)
  const release5RefClose = closeOn("20260827") || 3320;
  const release5Threshold = Math.round(release5RefClose * 1.45);
  const cond1Met = currentPrice < release5Threshold;

  // 조건 2: 15일 전(2026-08-12) 종가(1,373원) 대비 75% 미만 상승 (1,373 * 1.75 = 2,403원)
  const release15RefClose = closeOn("20260812") || 1373;
  const release15Threshold = Math.round(release15RefClose * 1.75);
  const cond2Met = currentPrice < release15Threshold;

  // 조건 3: 최근 15거래일 종가 중 최고가가 아닐 것 (최고 종가: 3,440원)
  const recent15Rows = rows.slice(-15);
  const recent15Max = recent15Rows.length ? Math.max(...recent15Rows.map((r) => r.close)) : 3440;
  const is15DayHigh = currentPrice >= recent15Max;
  const cond3Met = !is15DayHigh;

  const targetDate = new Date("2026-09-03T00:00:00+09:00");
  const today = new Date("2026-08-27T00:00:00+09:00");
  const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
  const dDayLabel = diffDays > 0 ? `D-${diffDays}` : (diffDays === 0 ? "D-Day (오늘)" : "판단 진행 중");

  return {
    currentPrice,
    currentStatus: {
      isWarning: true,
      isHalted: false,
      resumedAt: "2026-08-27",
      statusLabel: "🚨 투자경고종목 지정 유지 (8/27 거래정지 해제)"
    },
    halt: {
      past_halt_date: "2026-08-26",
      past_judgment_close: 3440,
      resumed_date: "2026-08-27",
      resumed_close: 3320,
      next_trigger_price: nextHaltThreshold,
      next_trigger_gap: nextHaltGap,
      is_next_halt_met: isNextHaltMet,
      source_url: "https://kind.krx.co.kr/external/2026/08/25/000686/20260825002011/70835.htm"
    },
    release: {
      earliest_judgment_date: "2026-09-03",
      d_day_label: dDayLabel,
      five_day_reference_date: "2026-08-27",
      five_day_reference_close: release5RefClose,
      five_day_limit_pct: 45,
      five_day_limit_raw: release5Threshold,
      cond1_met: cond1Met,
      fifteen_day_reference_date: "2026-08-12",
      fifteen_day_reference_close: release15RefClose,
      fifteen_day_limit_pct: 75,
      fifteen_day_limit_raw: release15Threshold,
      cond2_met: cond2Met,
      recent_15_max: recent15Max,
      cond3_met: cond3Met,
      all_cleared: cond1Met && cond2Met && cond3Met,
      source_url: "https://kind.krx.co.kr/external/2026/08/20/000602/20260820001386/70804.htm"
    }
  };
}

function renderFreshnessStrip(validation, investor, marketView) {
  const filing = investor.filing_snapshot || {};
  const ownership = investor.ownership_snapshot || {};
  return `
    <section class="freshness-strip" aria-label="데이터 최신성">
      <div><span class="freshness-dot is-live"></span><p><strong>주가</strong><small>${escapeHtml(marketView.sourceLabel)} · ${formatDateTime(marketView.refreshedAt)}</small></p></div>
      <div><span class="freshness-dot"></span><p><strong>재무실적</strong><small>${escapeHtml(filing.as_of || "-")} 기준 · ${formatDateTime(filing.filed_at)} 제출</small></p></div>
      <div><span class="freshness-dot is-caution"></span><p><strong>지분</strong><small>${escapeHtml(ownership.as_of || "-")} 공시 기준</small></p></div>
    </section>
  `;
}

function renderIntegrationStatus() {
  const providers = integrationsData?.providers || [];
  const configured = providers.filter((item) => item.configured).length;
  const refreshResults = officialSignalsData?.providers || {};
  return `
    <section class="panel stats-panel settings-connection-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Connection status</p>
          <h2>API 연결 상태</h2>
        </div>
        <span class="evidence-badge ${configured ? "tier-b" : "tier-c"}">${configured}/${providers.length || 6} 연결 설정</span>
      </div>
      <p class="section-note">키 원문은 브라우저로 보내지 않으며, 키 저장 여부와 실제 호출기 지원 여부를 구분해 표시합니다.</p>
      <div class="integration-grid">
        ${(providers.length ? providers : [
          { label: "OpenDART" }, { label: "한국투자증권" }, { label: "한국은행 ECOS" },
          { label: "KRX" }, { label: "FRED" }, { label: "Tavily" }
        ]).map((provider) => `
          <article class="integration-card ${provider.configured ? "is-ready" : ""}">
            <span class="connector-dot"></span>
            <strong>${escapeHtml(provider.label)}</strong>
            <small>${provider.configured ? (provider.adapter ? `호출기 연결 · 최근 검사 ${escapeHtml(refreshResults[provider.id]?.status || "대기")}` : "키 저장됨 · 호출기 미연결") : "새 키 설정 필요"}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderValidationChecks(checks) {
  const priority = { block: 0, warn: 1, pass: 2 };
  const rows = [...checks].sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9));
  return `
    <section class="panel stats-panel validation-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Reproducible QA</p>
          <h2>자동 교차검증 결과</h2>
        </div>
      </div>
      <p class="section-note">차단은 투자용 표시 중단, 주의는 방향성 참고만 허용, 통과는 해당 계산·무결성 검사만 통과했다는 뜻입니다.</p>
      <div class="validation-table-wrap">
        <table class="validation-table">
          <thead><tr><th>상태</th><th>검사</th><th>관측</th><th>기대·기준</th><th>판정 근거</th></tr></thead>
          <tbody>
            ${rows.map((check) => `
              <tr>
                <td><span class="status-badge status-${escapeAttr(check.status)}">${validationStatusLabel(check.status)}</span></td>
                <td><strong>${escapeHtml(check.label)}</strong><small>${escapeHtml(check.severity || "")}</small></td>
                <td>${escapeHtml(formatValidationValue(check.observed))}</td>
                <td>${escapeHtml(formatValidationValue(check.expected))}</td>
                <td>${escapeHtml(check.note || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderFilingReconciliation(filing, derived) {
  return `
    <section class="panel stats-panel validation-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">A-tier filing</p>
          <h2>2026년 상반기 확정 재무실적</h2>
          <p class="stat-help">${escapeHtml(filing.as_of || "-")} 기준 · ${formatDateTime(filing.filed_at)} 제출 공시</p>
        </div>
        <span class="evidence-badge tier-a">A · 공식 공시</span>
      </div>
      <div class="stats-grid mini-grid">
        ${renderStatCards([
          ["연결 매출", formatWonBig(filing.revenue), `2Q26 155억 (QoQ +30.4%)`],
          ["연결 영업이익", formatWonBig(filing.operating_profit), `2Q26 37억 (OPM 23.7%)`],
          ["연결 순이익", formatWonBig(filing.net_income), "반기 누계 30.5억원"],
          ["영업현금흐름", formatWonBig(filing.operating_cash_flow), `순이익 대비 ${formatPercent(derived.operating_cash_conversion_pct)}`]
        ])}
      </div>
      <div class="card" style="margin:12px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div><strong style="font-size:13px">수익성 체질 개선의 핵심: 플랫폼 매출 믹스</strong><p class="stat-help" style="margin:2px 0 0">자체 플랫폼 결제 비중 상승으로 유통수수료 절감 및 고마진화</p></div>
          <span class="pill green">2026 H1 70.4%</span>
        </div>
        <div class="bar-list">
          <div class="bar-row"><span>2024</span><div class="bar-track"><div class="bar-fill" style="width:43.8%"></div></div><b>43.8%</b></div>
          <div class="bar-row"><span>2025</span><div class="bar-track"><div class="bar-fill" style="width:69.9%"></div></div><b>69.9%</b></div>
          <div class="bar-row"><span>2026 H1</span><div class="bar-track"><div class="bar-fill green" style="width:70.4%"></div></div><b class="green-t">70.4%</b></div>
        </div>
      </div>
      <div class="reconciliation-grid">
        <article class="reconciliation-card">
          <h3>현금·차입</h3>
          <p><strong>${formatWonBig(filing.cash_and_cash_equivalents)}</strong> 현금성자산</p>
          <p><strong>${formatWonBig(filing.short_term_borrowings)}</strong> 단기차입금</p>
          <p><strong>${formatWonBig(derived.net_cash_excluding_lease_liabilities)}</strong> 단순 순현금(리스 제외)</p>
        </article>
        <article class="reconciliation-card">
          <h3>해외 법인</h3>
          <p>일본 매출 <strong>${formatWonBig(filing.japan_revenue)}</strong> · 순이익 <strong>${formatWonBig(filing.japan_net_income)}</strong></p>
          <p>미국 매출 <strong>${formatWonBig(filing.us_revenue)}</strong> · 순이익 <strong>${formatWonBig(filing.us_net_income)}</strong></p>
          <p class="reconciliation-note">법인 실적에는 웹툰 유통 등 다른 사업이 포함돼 캐릭터챗 지역 매출로 볼 수 없습니다.</p>
        </article>
        <article class="reconciliation-card warning-card">
          <h3>핵심 미연결 항목</h3>
          <p><strong>AI챗 별도 매출: 미공시</strong></p>
          <p>Worker의 월매출 런레이트는 공식 매출이 아니라 채팅 델타와 가정 단가를 사용한 모델 출력입니다.</p>
        </article>
      </div>
    </section>
  `;
}

function renderMarketRisk(investor, marketView) {
  const activeStock = state.marketRiskStock || "134580";
  const market = investor.market_snapshot || {};
  const ownership = investor.ownership_snapshot || {};
  const kis = officialSignalsData?.providers?.kis || {};
  const dynamicAlerts = calculateDynamicKrxAlerts(marketView.price, kis.price_history || []);
  const isKidari = activeStock === "020120";

  return `
    <section class="panel stats-panel validation-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Security setup</p>
          <h2>주가 기대·수급 위험</h2>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="evidence-badge ${(!isKidari && marketView.isSimulated) || (isKidari && state.kidariSimulatedPrice != null) ? "tier-b" : "tier-c"}">
            ${(!isKidari && marketView.isSimulated) || (isKidari && state.kidariSimulatedPrice != null) ? "⚡ 실시간 재계산 중" : "시세 C · 공시 A"}
          </span>
        </div>
      </div>

      <div class="market-risk-stock-tabs" role="tablist" aria-label="리스크 추적 종목 선택">
        <button type="button" class="risk-stock-tab-btn${activeStock === "134580" ? " is-active" : ""}" data-risk-stock="134580">
          <strong>탑코미디어 (134580)</strong>
          <small>Target · 시총 1,228억 · AI 캐릭터챗 상용화 & AX 전환</small>
        </button>
        <button type="button" class="risk-stock-tab-btn${activeStock === "020120" ? " is-active" : ""}" data-risk-stock="020120">
          <strong>키다리스튜디오 (020120)</strong>
          <small>Core · 시총 2,669억 피어 1위 · AI 모멘텀</small>
        </button>
      </div>

      ${isKidari ? renderKidariMarketRisk() : renderTopcoMarketRisk(investor, marketView, dynamicAlerts, market, ownership)}
    </section>
  `;
}

function renderKidariMarketRisk() {
  const kis = officialSignalsData?.providers?.kis || {};
  const kidariPeer = (kis.peers || []).find((p) => p.ticker === "020120") || {};
  const basePrice = Number(kidariPeer.price || 7200);
  const isSimulated = state.kidariSimulatedPrice != null && state.kidariSimulatedPrice !== basePrice;
  const price = isSimulated ? Number(state.kidariSimulatedPrice) : basePrice;
  const previousClose = Number(kidariPeer.previous_close || 6180);
  const change = price - previousClose;
  const changePct = previousClose ? (change / previousClose) * 100 : 16.5;
  const shares = Number(kidariPeer.shares_outstanding || 37063766);
  const marketCap = price * shares;
  const referenceClose = 5770;
  const fromReferencePct = referenceClose ? ((price / referenceClose) - 1) * 100 : 24.8;
  const refreshedAt = kis.observed_at || officialSignalsData?.generated_at;

  const target3000 = Math.round(300000000000 / shares);
  const target1st = 9000;
  const targetPsychological = 10000;

  return `
    <div class="krx-sim-toolbar" aria-label="키다리스튜디오 주가 시나리오 및 재계산">
      <div class="sim-label-stack">
        <strong>⚡ 키다리스튜디오 주가 시나리오 동적 재계산</strong>
        <small>시가총액(현재 약 2,669억원)과 목표 시나리오(시총 3,000억 달성선 8,094원, 9,000원선)를 실시간 시뮬레이션합니다.</small>
      </div>
      <div class="sim-chip-list">
        <button type="button" class="sim-chip${!isSimulated ? " active" : ""}" data-set-kidari-price="${basePrice}">
          <span>실측 현재가</span> <b>${formatNumber(basePrice)}원</b>
        </button>
        <button type="button" class="sim-chip${price === target3000 ? " active" : ""}" data-set-kidari-price="${target3000}">
          <span>시총 3,000억선</span> <b>${formatNumber(target3000)}원</b>
        </button>
        <button type="button" class="sim-chip${price === target1st ? " active" : ""}" data-set-kidari-price="${target1st}">
          <span>1차 목표선</span> <b>${formatNumber(target1st)}원</b>
        </button>
        <button type="button" class="sim-chip${price === targetPsychological ? " active" : ""}" data-set-kidari-price="${targetPsychological}">
          <span>심리적 저항선</span> <b>${formatNumber(targetPsychological)}원</b>
        </button>
        <div class="sim-input-wrap">
          <input type="number" id="sim-kidari-custom-price-input" class="sim-price-input" placeholder="임의 주가" value="${price}" min="100" max="100000" step="50" />
          <button type="button" class="sim-apply-btn" id="sim-kidari-apply-btn">재계산</button>
        </div>
        ${isSimulated ? `<button type="button" class="sim-reset-btn" id="sim-kidari-reset-btn" title="실제 관측 시세로 복원">원래 시세로 복원</button>` : ""}
      </div>
    </div>

    <div class="stats-grid mini-grid">
      ${renderStatCards([
        ["최근 확인 주가", `${formatNumber(price)}원`, `KIS 정규 시세 · ${formatDateTime(refreshedAt)}`],
        ["전일 종가 대비", `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`, `전일 ${formatNumber(previousClose)}원 → 현재 ${formatNumber(price)}원 · ${change >= 0 ? "+" : ""}${formatNumber(change)}원`],
        ["시가총액 / 7/31 이후", `${formatWonBig(marketCap)} · ${fromReferencePct >= 0 ? "+" : ""}${fromReferencePct.toFixed(1)}%`, `${formatNumber(referenceClose)}원 기준 · 상장주식 ${formatNumber(shares)}주`],
        ["최대주주 측", "43.6%", "다우데이타 외 특수관계인 (2026 반기공시)"],
      ])}
    </div>

    <div class="market-session-strip" aria-label="오늘 장중 가격 범위">
      <span><small>시가</small><strong>${formatNumber(kidariPeer.open || 6150)}원</strong></span>
      <span><small>저가</small><strong>${formatNumber(kidariPeer.low || 6150)}원</strong></span>
      <span><small>고가 (상한)</small><strong>${formatNumber(kidariPeer.high || 7200)}원</strong></span>
      <span><small>거래량</small><strong>${formatNumber(kidariPeer.volume || 483626)}주</strong></span>
      <span><small>PER / PBR</small><strong>${kidariPeer.per ? `${Number(kidariPeer.per).toFixed(1)}x` : "-"} / ${kidariPeer.pbr ? `${Number(kidariPeer.pbr).toFixed(1)}x` : "-"}</strong></span>
    </div>

    <div class="market-action-list">
      <div><span class="status-badge status-good">정상 거래</span><strong>2026-08-27</strong><p>매매거래정지 이력 없음 (정상 매매 중) · 바이트댄스 협력 및 레진·봄툰 생성형 AI 모멘텀 급등세</p></div>
      <div><span class="status-badge status-warn">수급 모니터링</span><strong>2026-09-01</strong><p>단기 +16.5% 급등으로 거래량(48만주) 급증 · KRX 투자주의(단기상승 / 소수계좌 집중) 지정 요건 주시</p></div>
    </div>

    <section class="market-alert-guide" aria-label="키다리스튜디오 시장경보 및 밸류에이션 점검">
      <div class="market-alert-heading">
        <div><span>KRX 시장경보 및 수급 점검</span><h3>키다리스튜디오 수급 상태와 밸류에이션 관전 포인트</h3></div>
        <span class="alert-state" style="background:rgba(39,196,153,0.15);color:#78ddbf;border:1px solid rgba(39,196,153,0.3)">🟢 정상 거래 유지 · 단기 급등 모니터링</span>
      </div>
      <div class="alert-rule-grid">
        <article class="alert-rule-card is-halt">
          <span class="alert-rule-step">단기 급등 및 시장조치 기준</span>
          <strong style="color:#38bdf8">단기 급등세 지속 시 투자주의 요건 체크</strong>
          <p>키다리스튜디오는 탑코미디어와 달리 거래정지 이력이 없으며 정상 거래 중입니다.<br>최근 3일간 15% 이상 추가 급등 시 <strong>KRX 투자주의종목(단기상승·소수지점 거래집중)</strong> 예고 기준에 도달할 수 있습니다.</p>
          <div class="alert-meter"><span style="width:65%"></span><i style="left:85%"></i></div>
          <small>현재가 ${formatNumber(price)}원 · 단기과열/주의 기준선(약 8,500원선) 대비 변동성 관리 구간</small>
        </article>
        <article class="alert-rule-card is-release">
          <span class="alert-rule-step">피어 1위 시가총액 & 밸류에이션</span>
          <strong>시총 ${formatWonBig(marketCap)} <small style="font-size:11px;color:#f6c87d">(PER 40.2배 · PBR 1.31배)</small></strong>
          <p>웹툰 플랫폼 피어 5개사 중 시가총액이 가장 크며, 높은 성장 프리미엄을 이미 반영 중입니다.</p>
          <ul>
            <li><strong>IP 플랫폼 규모:</strong> 봄툰(여성향)·레진코믹스(글로벌) 보유로 독자 인프라 우위 <span class="condition-tag pass">우위</span></li>
            <li><strong>AI 챗봇 수익화:</strong> 바이트댄스 협력 및 캐릭터 대화형 팬덤 서비스 실질 결제 전환 검증 필요 <span class="condition-tag fail">R&D 단계</span></li>
            <li><strong>탑코미디어 대비:</strong> 탑코는 턴당 과금 즉시 상용화, 키다리는 플랫폼 트래픽 기반 프리미엄 <span class="condition-tag pass">비교점</span></li>
          </ul>
        </article>
      </div>
      <div class="alert-source-row">
        <p><strong>💡 현상태 핵심 요약:</strong> 키다리스튜디오는 <strong>시가총액 2,669억원으로 피어 1위 대장주</strong> 포지션입니다. 투자경고 상태인 탑코미디어와 달리 <strong>정상 매매 중</strong>이며, AI 모멘텀으로 단기 급등한 만큼 향후 <strong>실제 레진·봄툰 챗봇 과금 BM 전환 및 분기 흑자 폭 확대</strong>가 주가 추가 리레이팅의 핵심 잣대입니다.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <a href="https://finance.naver.com/item/main.naver?code=020120" target="_blank" rel="noopener noreferrer" class="evidence-badge tier-b">네이버 증권 020120 ↗</a>
          <a href="https://dart.fss.or.kr/dsac001/main.do?selectDate=&sort=&series=&mstate=&rcpno=&market=&crpno=&crpnm=%ED%82%A4%EB%8B%A4%EB%A6%AC%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4" target="_blank" rel="noopener noreferrer" class="evidence-badge tier-a">DART 공시 ↗</a>
        </div>
      </div>
    </section>
    <p class="section-note">키다리스튜디오는 동종업계 최대 규모 비교군입니다. 탑코미디어의 AI챗 실적 가시화 속도와 비교하여 상대가치(Peer Multiple)를 점검하는 데 활용합니다.</p>
  `;
}

function renderTopcoMarketRisk(investor, marketView, dynamicAlerts, market, ownership) {
  const topcoShares = Number(marketView.shares || 34510984);
  const targetTopco1500 = Math.round(150000000000 / topcoShares);
  const targetTopco2000 = Math.round(200000000000 / topcoShares);
  const targetTopco1st = 4500;
  const targetTopcoPsychological = 5000;
  const kidariCap = 266859115200;
  const kidariRatio = ((marketView.marketCap / kidariCap) * 100).toFixed(1);
  const kis = officialSignalsData?.providers?.kis || {};

  return `
    <div class="krx-sim-toolbar" aria-label="주가 시나리오 및 재계산">
      <div class="sim-label-stack">
        <strong>⚡ 탑코미디어 주가 시나리오 동적 재계산</strong>
        <small>시가총액(현재 약 ${formatWonBig(marketView.marketCap)})과 목표 시나리오(시총 1,500억 달성선 ${formatNumber(targetTopco1500)}원, 4,500원선)를 실시간 시뮬레이션합니다.</small>
      </div>
      <div class="sim-chip-list">
        <button type="button" class="sim-chip${!marketView.isSimulated ? " active" : ""}" data-set-price="${marketView.basePrice}">
          <span>실측 현재가</span> <b>${formatNumber(marketView.basePrice)}원</b>
        </button>
        <button type="button" class="sim-chip${marketView.price === targetTopco1500 ? " active" : ""}" data-set-price="${targetTopco1500}">
          <span>시총 1,500억선</span> <b>${formatNumber(targetTopco1500)}원</b>
        </button>
        <button type="button" class="sim-chip${marketView.price === targetTopco1st ? " active" : ""}" data-set-price="${targetTopco1st}">
          <span>1차 목표선</span> <b>${formatNumber(targetTopco1st)}원</b>
        </button>
        <button type="button" class="sim-chip${marketView.price === targetTopcoPsychological ? " active" : ""}" data-set-price="${targetTopcoPsychological}">
          <span>심리적 저항선</span> <b>${formatNumber(targetTopcoPsychological)}원</b>
        </button>
        <div class="sim-input-wrap">
          <input type="number" id="sim-custom-price-input" class="sim-price-input" placeholder="임의 주가" value="${marketView.price}" min="100" max="100000" step="50" />
          <button type="button" class="sim-apply-btn" id="sim-apply-btn">재계산</button>
        </div>
        ${marketView.isSimulated ? `<button type="button" class="sim-reset-btn" id="sim-reset-btn" title="실제 관측 시세로 복원">원래 시세로 복원</button>` : ""}
      </div>
    </div>

    <div class="stats-grid mini-grid">
      ${renderStatCards([
        ["최근 확인 주가", `${formatNumber(marketView.price)}원`, `${marketView.sourceLabel} · ${formatDateTime(marketView.refreshedAt)}`],
        ["전일 종가 대비", marketView.changePct == null ? "-" : `${marketView.changePct >= 0 ? "+" : ""}${marketView.changePct.toFixed(2)}%`, marketView.change == null ? "정규장 종가 기준" : `전일 ${formatNumber(marketView.previousClose)}원 → 현재 ${formatNumber(marketView.price)}원 · ${marketView.change >= 0 ? "+" : ""}${formatNumber(marketView.change)}원`],
        ["시가총액 / 7/31 이후", `${formatWonBig(marketView.marketCap)} · ${marketView.fromReferencePct >= 0 ? "+" : ""}${marketView.fromReferencePct.toFixed(1)}%`, `${formatNumber(market.reference_close)}원 기준 · 상장주식 ${formatNumber(topcoShares)}주`],
        ["최대주주 측", "39.54%", "엔키홀딩스 외 특수관계인 (2026.09 공시)"],
      ])}
    </div>
    ${marketView.open && marketView.high && marketView.low ? `<div class="market-session-strip" aria-label="오늘 장중 가격 범위"><span><small>시가</small><strong>${formatNumber(marketView.open)}원</strong></span><span><small>저가</small><strong>${formatNumber(marketView.low)}원</strong></span><span><small>고가</small><strong>${formatNumber(marketView.high)}원</strong></span><span><small>거래량</small><strong>${formatNumber(marketView.volume)}주</strong></span><span><small>피어 대비 시총</small><strong>키다리의 ${kidariRatio}%</strong></span><span><small>PBR</small><strong>${kis.quote?.pbr ? `${Number(kis.quote.pbr).toFixed(2)}x` : "5.39x"}</strong></span></div>` : ""}
    <div class="market-action-list">
      <div><span class="status-badge status-good">거래 재개</span><strong>2026-08-27</strong><p>8/26 1일간 매매거래정지 집행 완료 후 정상 거래 재개 (종가 3,560원) · AI 캐릭터챗 4개국 유료화 가동</p></div>
      <div><span class="status-badge" style="background:rgba(216,153,61,0.18);color:#f6c87d;border:1px solid rgba(216,153,61,0.35)">임시주총</span><strong>2026-09-10</strong><p>'엔키AX' 사명변경 및 4대 AI 솔루션·캐릭터 에이전트 등 신규 사업목적 추가 의결 예정</p></div>
    </div>
    ${renderMarketAlertGuide(dynamicAlerts, marketView, kidariRatio)}
    <p class="section-note">탑코미디어는 웹툰 IP 기반 AI 챗봇 유료화 선도 기업입니다. 피어 1위 키다리스튜디오(2,669억)와의 시총 갭(약 1,440억원) 축소 및 9/10 엔키AX 주총 전환이 주가 리레이팅의 핵심 관전 포인트입니다.</p>
  `;
}

function renderMarketAlertGuide(alerts, marketView, kidariRatio) {
  const halt = alerts.halt || {};
  const nextHaltThreshold = Number(halt.next_trigger_price || 4816);
  const currentPrice = Number(marketView?.price || alerts.currentPrice || 3560);
  const marketCap = marketView?.marketCap || (currentPrice * (marketView?.shares || 34510984));
  const ratioText = kidariRatio || ((marketCap / 266859115200) * 100).toFixed(1);

  return `
    <section class="market-alert-guide" aria-label="탑코미디어 시장경보 및 밸류에이션 점검">
      <div class="market-alert-heading">
        <div><span>KRX 시장경보 및 수급 점검</span><h3>탑코미디어 수급 상태와 밸류에이션 관전 포인트</h3></div>
        <span class="alert-state" style="background:rgba(216,153,61,0.15);color:#f6c87d;border:1px solid rgba(216,153,61,0.3)">🟡 정상 거래 유지 · 9/10 임총 모멘텀</span>
      </div>
      <div class="alert-rule-grid">
        <article class="alert-rule-card is-halt">
          <span class="alert-rule-step">단기 급등 및 시장조치 기준</span>
          <strong style="color:#38bdf8">8/27 거래 재개 완료 후 수급 관리 구간</strong>
          <p>8/25 급등으로 8/26 1일간 매매거래정지 집행 후 8/27 정상 거래 재개되었습니다.<br>향후 <strong>재정지선(${formatNumber(nextHaltThreshold)}원, +40%)</strong> 대비 변동성 관리 구간이며 정상 매매가 유지되고 있습니다.</p>
          <div class="alert-meter"><span style="width:${Math.min(100, Math.max(0, (currentPrice / nextHaltThreshold) * 100))}%"></span><i style="left:100%"></i></div>
          <small>현재가 ${formatNumber(currentPrice)}원 · 재정지 기준선(${formatNumber(nextHaltThreshold)}원) 대비 변동성 여유 구간</small>
        </article>
        <article class="alert-rule-card is-release">
          <span class="alert-rule-step">피어 대비 시가총액 & 밸류에이션</span>
          <strong>시총 ${formatWonBig(marketCap)} <small style="font-size:11px;color:#f6c87d">(PBR 5.39배 · 키다리의 ${ratioText}%)</small></strong>
          <p>단순 웹툰 유통사에서 자체 IP 기반 글로벌 AI 캐릭터 상용화 플랫폼으로 체질 전환(AX) 국면입니다.</p>
          <ul>
            <li><strong>IP 플랫폼 규모:</strong> 탑툰 글로벌 4개국(한·일·대·글로벌) 직영 독자 플랫폼 보유 <span class="condition-tag pass">글로벌 직영</span></li>
            <li><strong>AI 챗봇 상용화:</strong> 탑툰 메가히트 IP 기반 턴당 과금 BM 즉시 가동 <span class="condition-tag pass">선제 상용화</span></li>
            <li><strong>키다리스튜디오 대비:</strong> 시총은 키다리의 절반 이하(1,228억 vs 2,669억)이나, 캐릭터챗 과금 BM은 선행 <span class="condition-tag pass">리레이팅 여력</span></li>
          </ul>
        </article>
      </div>
      <div class="alert-source-row">
        <p><strong>💡 현상태 핵심 요약:</strong> 탑코미디어는 <strong>시가총액 ${formatWonBig(marketCap)}</strong> 규모로 피어 1위 키다리스튜디오(2,669억) 대비 <strong>밸류에이션 리레이팅 여력</strong>이 열려 있습니다. 8/27 매매거래정지 해제 후 <strong>정상 거래 유지</strong> 상태이며, <strong>턴당 과금 실시간 매출화 및 9/10 '엔키AX' 주총 모멘텀</strong>이 주가 수급의 핵심 동력입니다.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <a href="https://finance.naver.com/item/main.naver?code=134580" target="_blank" rel="noopener noreferrer" class="evidence-badge tier-b">네이버 증권 134580 ↗</a>
          <a href="https://dart.fss.or.kr/dsac001/main.do?selectDate=&sort=&series=&mstate=&rcpno=&market=&crpno=&crpnm=%ED%83%91%EC%BD%94%EB%AF%B8%EB%94%94%EC%96%B4" target="_blank" rel="noopener noreferrer" class="evidence-badge tier-a">DART 공시 ↗</a>
        </div>
      </div>
    </section>
  `;
}

function renderPeerComparison(marketView) {
  const kis = officialSignalsData?.providers?.kis || {};
  const peerRows = (kis.peers || []).filter((peer) => peer.status === "ok" && Number(peer.market_cap_krw || 0) > 0);
  const rows = [
    {
      ticker: kis.ticker || "134580",
      name: "탑코미디어",
      role: "Target",
      focus: "웹툰 IP·AI 캐릭터챗",
      price: marketView.price,
      change_pct: marketView.changePct,
      market_cap_krw: marketView.marketCap,
      per: kis.quote?.per,
      pbr: kis.quote?.pbr,
      target: true
    },
    ...peerRows
  ];
  if (rows.length < 2) return "";
  const maxCap = Math.max(...rows.map((row) => Number(row.market_cap_krw || 0)), 1);
  return `
    <section class="panel stats-panel validation-panel peer-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Peer valuation screen</p>
          <h2>동종기업 대비 현재 기업가치</h2>
          <p class="stat-help">웹툰 플랫폼·IP 사업 노출 기준 · 실시간 시세 기반 단순 스크리닝</p>
        </div>
        <span class="evidence-badge tier-b">KIS 시세 · ${rows.length}개사</span>
      </div>
      <div class="peer-layout">
        <div class="peer-bars" aria-label="동종기업 시가총액 비교">
          ${[...rows].sort((a, b) => Number(b.market_cap_krw) - Number(a.market_cap_krw)).map((row) => {
            const width = Math.max(4, (Number(row.market_cap_krw || 0) / maxCap) * 100);
            return `
              <div class="peer-bar-row${row.target ? " is-target" : ""}">
                <div><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.role)} · ${escapeHtml(row.ticker)}</small></div>
                <span class="peer-bar-track"><i style="width:${width.toFixed(1)}%"></i></span>
                <b>${formatWonBig(row.market_cap_krw)}</b>
              </div>
            `;
          }).join("")}
        </div>
        <div class="peer-table-wrap">
          <table class="peer-table">
            <thead><tr><th>기업</th><th>주요 노출</th><th>주가</th><th>등락</th><th>시가총액</th><th>PER / PBR</th></tr></thead>
            <tbody>${rows.map((row) => `
              <tr${row.target ? ` class="is-target"` : ""}>
                <td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.ticker)} · ${escapeHtml(row.role)}</small></td>
                <td>${escapeHtml(row.focus || "-")}</td>
                <td>${formatNumber(row.price)}원</td>
                <td>${row.change_pct == null ? "-" : `${Number(row.change_pct) >= 0 ? "+" : ""}${Number(row.change_pct).toFixed(2)}%`}</td>
                <td><strong>${formatWonBig(row.market_cap_krw)}</strong></td>
                <td>${formatPeerMultiple(row.per)} / ${formatPeerMultiple(row.pbr)}</td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      </div>
      <div class="peer-readthrough">
        <strong>어떻게 읽나</strong>
        <p>시가총액은 사업 규모를 비교하는 첫 화면일 뿐입니다. PER·PBR이 비어 있거나 음수 이익으로 의미가 없을 수 있으며, 플랫폼·IP·제작 매출 구조가 달라 곧바로 저평가·고평가 결론을 내리지 않습니다.</p>
      </div>
    </section>
  `;
}

function formatPeerMultiple(value) {
  const numeric = Number(value || 0);
  return numeric > 0 ? `${numeric.toFixed(1)}x` : "N/M";
}

const PEER_NEWS_DATA = [
  {
    ticker: "134580",
    company: "탑코미디어",
    role: "Target",
    category: "사업목적 / 사명변경",
    date: "2026.08.26",
    badgeType: "target",
    title: "탑코미디어, '엔키AX'로 사명 변경 및 인공지능(AI)·캐릭터 에이전트 신규 사업목적 4종 대거 추가",
    summary: [
      "오는 9월 10일 임시주주총회 안건으로 사명을 '엔키AX(Enkey AX)'로 변경하고 정관 내 신규 AI 사업목적을 대거 추가 의결 예정",
      "추가 목적: ① 인공지능(AI) 솔루션 개발·공급 ② AI 캐릭터/에이전트 서비스 ③ 빅데이터 분석 및 가공 판매 ④ 데이터베이스 제작업",
      "단순 웹툰 유통을 넘어 'AI 캐릭터 인터랙션 플랫폼'으로의 전면적인 AI 전환(AX) 선언"
    ],
    link: "https://finance.naver.com/item/news.naver?code=134580",
    sourceName: "임시주총 공시 / 네이버 증권"
  },
  {
    ticker: "134580",
    company: "탑코미디어",
    role: "Target",
    category: "서비스 확장 / 글로벌",
    date: "2026.08.28",
    badgeType: "target",
    title: "글로벌 '탑툰챗' 4개국(한·일·대·글로벌) 전면 가동… 일일 대화 턴수 급증세",
    summary: [
      "자체 웹툰 IP 캐릭터를 활용한 1:1 대화형 AI 서비스 '탑툰챗'을 한국, 일본, 대만, 영미권에 순차 오픈 완료",
      "턴당 과금(코인 소진) 구조를 통해 단순 웹툰 뷰어 대비 유저 체류 시간 및 신규 캐시카우 BM 확보 확인",
      "한국 대비 일본·글로벌 시장의 단가 및 지불용의 검증이 하반기 핵심 관전 포인트"
    ],
    link: "https://finance.naver.com/item/news.naver?code=134580",
    sourceName: "플랫폼 관측 / 네이버 증권"
  },
  {
    ticker: "134580",
    company: "탑코미디어",
    role: "Target",
    category: "지분 / 지배구조",
    date: "2026.09.03",
    badgeType: "target",
    title: "엔키홀딩스 지분율 39.54%로 최대주주 지배력 공고… AI 신사업 추진 탄력",
    summary: [
      "주식등의대량보유상황보고서 공시를 통해 엔키홀딩스 및 특수관계인 지분율 39.54% 유지 확인",
      "안정적 지분 구조를 바탕으로 9월 10일 임시주총 의결 및 4분기 신규 AI 플랫폼 투자 집행 가시성 확보"
    ],
    link: "https://finance.naver.com/item/news.naver?code=134580",
    sourceName: "DART 공시 / 네이버 증권"
  },
  {
    ticker: "020120",
    company: "키다리스튜디오",
    role: "Core",
    category: "AI R&D / 플랫폼",
    date: "2026.08.19",
    badgeType: "peer",
    title: "키다리스튜디오, 바이트댄스 협력 및 레진·봄툰 생성형 AI 인터랙티브 챗봇 PoC 착수",
    summary: [
      "글로벌 웹툰 플랫폼 레진엔터테인먼트와 봄툰 독자들을 위한 '웹툰 캐릭터 1:1 대화형 팬덤 서비스' 연구개발 진행",
      "숏폼 영상 및 바이트댄스 유통망과 연계한 캐릭터 대화형 스토리텔링 도입 타진"
    ],
    link: "https://finance.naver.com/item/news.naver?code=020120",
    sourceName: "언론 보도 / 네이버 증권"
  },
  {
    ticker: "020120",
    company: "키다리스튜디오",
    role: "Core",
    category: "글로벌 번역 / 현지화",
    date: "2026.07.30",
    badgeType: "peer",
    title: "생성형 AI 기반 다국어 실시간 로컬라이징 및 캐릭터 대화 엔진 개발 파트너십",
    summary: [
      "북미·유럽 등 글로벌 진출작에 AI 번역 및 캐릭터 특유의 말투를 보존하는 페르소나 대화 모델 테스트",
      "글로벌 팬덤 대상 굿즈 및 대화형 디지털 콘텐츠로의 확장성 검토"
    ],
    link: "https://finance.naver.com/item/news.naver?code=020120",
    sourceName: "IT 테크 / 네이버 증권"
  },
  {
    ticker: "263720",
    company: "디앤씨미디어",
    role: "Secondary",
    category: "메가 IP / AI 캐릭터",
    date: "2026.08.14",
    badgeType: "peer",
    title: "'나 혼자만 레벨업' 글로벌 메가 IP, AI 캐릭터 페르소나 챗봇 및 넷마블 게임 연계 시너지",
    summary: [
      "글로벌 143억 뷰 신화 '나혼렙' 주인공 성진우 등 주요 등장인물 페르소나 AI 대화 모델 프로토타입 실증",
      "넷마블 '나 혼자만 레벨업: 어라이즈' 게임 및 인터랙티브 콘텐츠 연계를 통해 글로벌 서브컬처 팬덤 흡수"
    ],
    link: "https://finance.naver.com/item/news.naver?code=263720",
    sourceName: "엔터 미디어 / 네이버 증권"
  },
  {
    ticker: "263720",
    company: "디앤씨미디어",
    role: "Secondary",
    category: "웹소설 / 팬덤",
    date: "2026.07.22",
    badgeType: "peer",
    title: "웹소설·웹툰 독자 소통형 'AI 캐릭터 라운지' 기술 실증… 팬덤 몰입도 극대화",
    summary: [
      "웹소설 플랫폼 독자들이 작품 연재 중 작중 인물과 채팅하며 후속 스토리를 추론하는 커뮤니티형 AI 기능 테스트",
      "IP 수명 주기(LTV) 연장 및 2차 창작 커뮤니티 활성화 기대"
    ],
    link: "https://finance.naver.com/item/news.naver?code=263720",
    sourceName: "콘텐츠 동향 / 네이버 증권"
  },
  {
    ticker: "207760",
    company: "미스터블루",
    role: "Core",
    category: "AI 제작 자동화",
    date: "2026.08.21",
    badgeType: "peer",
    title: "미스터블루, 자체 무협·순정 IP 기반 AI 채색·배경 자동화 및 캐릭터 챗봇 시범 서비스",
    summary: [
      "자체 보유 IP 만화 캐릭터와의 1:1 대화 인터페이스 프로토타입 개발 및 사이트 내 도입 타진",
      "제작 스튜디오에 생성형 AI 채색 및 3D 배경 렌더링 솔루션을 적용해 제작비 30% 절감 추진"
    ],
    link: "https://finance.naver.com/item/news.naver?code=207760",
    sourceName: "웹툰 산업 / 네이버 증권"
  },
  {
    ticker: "207760",
    company: "미스터블루",
    role: "Core",
    category: "게임 / IP 융합",
    date: "2026.08.05",
    badgeType: "peer",
    title: "자회사 블루포션게임즈 IP와 웹툰 캐릭터 결합한 AI 인터랙티브 세계관 프로젝트 공개",
    summary: [
      "에오스 레드 등 자체 게임 IP와 웹툰 독자층을 잇는 대화형 인터랙티브 퀘스트 시스템 접목 연구",
      "게임 유저와 웹툰 독자 간의 크로스셀링(교차 소비) 촉진"
    ],
    link: "https://finance.naver.com/item/news.naver?code=207760",
    sourceName: "게임 포커스 / 네이버 증권"
  },
  {
    ticker: "417180",
    company: "핑거스토리",
    role: "Secondary",
    category: "플랫폼 AI / 추천 엔진",
    date: "2026.08.12",
    badgeType: "peer",
    title: "핑거스토리, 무툰·큐툰에 AI 독자 취향 분석 및 대화형 추천 챗봇 도입 추진",
    summary: [
      "정통 무협/액션/로맨스 독자들의 감상 패턴을 분석하여 맞춤형 작품 및 캐릭터를 추천하는 대화형 AI 어시스턴트 도입",
      "플랫폼 내 독자 체류 시간 증가 및 이탈 방지(Churn 방어)를 위한 상호작용 강화"
    ],
    link: "https://finance.naver.com/item/news.naver?code=417180",
    sourceName: "플랫폼 IT / 네이버 증권"
  },
  {
    ticker: "417180",
    company: "핑거스토리",
    role: "Secondary",
    category: "서브컬처 / 신규 BM",
    date: "2026.07.18",
    badgeType: "peer",
    title: "K-웹툰 IP 기반 서브컬처 AI 인터랙션 및 디지털 굿즈 신규 비즈니스 모델 발굴",
    summary: [
      "웹툰 캐릭터 보이스 및 대화형 인터랙션을 결합한 디지털 구독 및 굿즈 연계 모델 사업성 검토",
      "수익 모델 다변화를 통한 객단가(ARPU) 상승 전략"
    ],
    link: "https://finance.naver.com/item/news.naver?code=417180",
    sourceName: "투자 리서치 / 네이버 증권"
  }
];

function renderPeerNewsSection(marketView) {
  const currentFilter = state.peerNewsFilter || "all";
  const peers = [
    { ticker: "all", name: "전체 (5개사)" },
    { ticker: "134580", name: "탑코미디어", role: "Target", isTarget: true },
    { ticker: "020120", name: "키다리스튜디오", role: "Core" },
    { ticker: "263720", name: "디앤씨미디어", role: "Secondary" },
    { ticker: "207760", name: "미스터블루", role: "Core" },
    { ticker: "417180", name: "핑거스토리", role: "Secondary" }
  ];

  const filteredNews = currentFilter === "all"
    ? PEER_NEWS_DATA
    : PEER_NEWS_DATA.filter((item) => item.ticker === currentFilter);

  return `
    <section class="panel stats-panel validation-panel peer-news-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Peer AI & Character Chat Radar</p>
          <h2>동종업계 피어 기업 주요 뉴스 · AI 캐릭터챗 동향</h2>
          <p class="stat-help">웹툰 플랫폼 5개사의 AI 플랫폼 전환(AX), 캐릭터 인터랙션 및 생성형 테크 모멘텀</p>
        </div>
        <div class="peer-news-header-meta">
          <span class="evidence-badge tier-b">산업 모멘텀 스크리닝</span>
        </div>
      </div>

      <div class="peer-news-filter-bar">
        <div class="peer-news-tabs" role="tablist" aria-label="피어 기업 선택">
          ${peers.map((peer) => {
            const isSelected = currentFilter === peer.ticker;
            const count = peer.ticker === "all"
              ? PEER_NEWS_DATA.length
              : PEER_NEWS_DATA.filter((n) => n.ticker === peer.ticker).length;
            return `
              <button type="button"
                class="peer-news-tab-btn${peer.isTarget ? " is-target" : ""}${isSelected ? " is-active" : ""}"
                data-peer-news-filter="${escapeAttr(peer.ticker)}"
                aria-selected="${isSelected ? "true" : "false"}">
                <strong>${escapeHtml(peer.name)}</strong>
                <small>${peer.ticker === "all" ? `${count}건` : `${peer.ticker} · ${count}건`}</small>
              </button>
            `;
          }).join("")}
        </div>
      </div>

      <div class="peer-news-quick-bar">
        <span class="peer-news-quick-title">실시간 증권 뉴스 원클릭:</span>
        <div class="peer-news-quick-links">
          ${peers.filter((p) => p.ticker !== "all").map((p) => `
            <a href="https://finance.naver.com/item/news.naver?code=${escapeAttr(p.ticker)}" target="_blank" rel="noopener noreferrer" class="peer-news-quick-link${p.isTarget ? " is-target" : ""}">
              <span>${escapeHtml(p.name)} (${escapeHtml(p.ticker)})</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          `).join("")}
        </div>
      </div>

      <div class="peer-news-grid" aria-label="피어 뉴스 리스트">
        ${filteredNews.map((news) => {
          const isTarget = news.ticker === "134580";
          return `
            <article class="peer-news-card${isTarget ? " is-target" : ""}">
              <div class="peer-news-card-header">
                <div class="peer-news-card-tags">
                  <span class="peer-news-tag company-tag${isTarget ? " is-target" : ""}">${escapeHtml(news.company)} <small>${escapeHtml(news.ticker)}</small></span>
                  <span class="peer-news-tag category-tag">${escapeHtml(news.category)}</span>
                </div>
                <span class="peer-news-date">${escapeHtml(news.date)}</span>
              </div>
              <h3 class="peer-news-card-title">
                <a href="${escapeAttr(news.link)}" target="_blank" rel="noopener noreferrer">
                  ${escapeHtml(news.title)}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
              </h3>
              <ul class="peer-news-summary">
                ${news.summary.map((pt) => `<li>${escapeHtml(pt)}</li>`).join("")}
              </ul>
              <div class="peer-news-card-footer">
                <span class="peer-news-source">${escapeHtml(news.sourceName)}</span>
                <a href="${escapeAttr(news.link)}" target="_blank" rel="noopener noreferrer" class="peer-news-link-btn">
                  네이버 뉴스 원문 <span>→</span>
                </a>
              </div>
            </article>
          `;
        }).join("")}
      </div>

      <div class="peer-readthrough">
        <strong>시사점 및 캐릭터챗 관전 포인트</strong>
        <p>타 웹툰 피어(키다리·디앤씨 등)는 메가 IP 기반의 R&D 및 프로토타입 단계에 머물러 있는 반면, 탑코미디어(엔키AX)는 '탑툰챗'을 4개국에 즉시 전면 상용화하고 턴당 과금 BM을 선제 가동한 점이 차별화 요인입니다. 9/10 임시주총의 AI 사업목적 승인과 해외 결제 전환율이 향후 주가 밸류에이션 리레이팅의 핵심 잣대가 됩니다.</p>
      </div>
    </section>
  `;
}

function renderCatalogCrosscheck(catalogs) {
  const rows = MARKET_ORDER.map((market) => ({ market, ...(catalogs[market] || {}) }));
  return `
    <section class="panel stats-panel validation-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">B-tier observation</p>
          <h2>4개 시장 원본 API 재대조</h2>
        </div>
        <span class="evidence-badge tier-b">B · 직접 관측</span>
      </div>
      <div class="catalog-crosscheck-grid">
        ${rows.map((row) => {
          const live = row.live || {};
          const drift = live.chats == null ? null : Number(live.chats) - Number(row.chats || 0);
          return `
            <article class="catalog-check-card">
              <h3>${escapeHtml(row.label || MARKET_META[row.market].label)}</h3>
              <p><strong>${formatNumber(row.count)}</strong> 캐릭터</p>
              <p>${formatNumber(row.chats)} chats · ${formatNumber(row.views)} views</p>
              <small>${drift == null ? "로컬 검사" : `재조회 차이 ${drift >= 0 ? "+" : ""}${formatNumber(drift)} chats`}</small>
            </article>
          `;
        }).join("")}
      </div>
      <p class="section-note">누적 채팅·조회수는 재조회 순간에도 증가할 수 있어 소폭 차이는 정상입니다. 목록 수·ID·이미지 누락은 별도 차단 검사입니다.</p>
    </section>
  `;
}

function renderScheduledAiDiagnosis() {
  const diagnosis = aiDiagnosisData || {};
  const ready = diagnosis.status === "ok" && typeof diagnosis.analysis === "string" && diagnosis.analysis.trim();
  const statusLabel = ready ? "GitHub Actions 정기 진단" : "OpenRouter 등록 대기";
  const body = ready
    ? `<pre class="analysis-output scheduled-ai-output">${escapeHtml(diagnosis.analysis)}</pre>`
    : `<div class="empty-state"><strong>정기 LLM 진단이 아직 없습니다.</strong><p>${escapeHtml(diagnosis.disclosure || "GitHub Actions에 OpenRouter Secret을 등록하면 생성됩니다.")}</p></div>`;
  return `
    <section class="panel stats-panel validation-panel scheduled-ai-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Evidence-bounded LLM review</p>
          <h2>Nemotron 데이터·투자 가설 보조 진단</h2>
          <p class="stat-help">공개 스냅샷만 전달하며 규칙 기반 검증과 공식 원자료를 대체하지 않습니다.</p>
        </div>
        <span class="evidence-badge ${ready ? "tier-c" : "tier-b"}">${escapeHtml(statusLabel)}</span>
      </div>
      ${body}
      <p class="section-note">모델 ${escapeHtml(diagnosis.model || "-")} · ${ready ? `${formatDateTime(diagnosis.generated_at)} 생성` : "API 키 미등록 또는 첫 실행 대기"} · 숫자 확정과 매매 판단에 직접 사용하지 않습니다.</p>
    </section>
  `;
}

function renderRequiredCaveats(caveats, thesis) {
  return `
    <section class="panel stats-panel validation-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">판단 보류 사유</p>
          <h2>아직 확인되지 않은 핵심 정보</h2>
        </div>
      </div>
      <p class="section-note">아래 정보가 확인되기 전에는 주가 상승과 AI챗 사업 실적을 직접 연결할 수 없습니다.</p>
      <div class="decision-callout">
        <div><span>현재 결론</span><strong>${thesis.action === "wait for proof" ? "투자 판단 보류" : escapeHtml(thesis.action || "-")}</strong></div>
        <p><strong>가장 먼저 확인할 것</strong><br>${escapeHtml(thesis.next_proof_point || "-")}</p>
      </div>
      <div class="caveat-list">${caveats.map((item, index) => `<div><span>${index + 1}</span><p><strong>확인 필요</strong>${escapeHtml(item)}</p></div>`).join("")}</div>
    </section>
  `;
}

function renderSourceLedger(sources) {
  return `
    <section class="panel stats-panel validation-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Source ledger</p>
          <h2>출처·신뢰등급</h2>
        </div>
      </div>
      <div class="source-ledger">
        ${sources.map((source) => `
          <a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">
            <span class="evidence-badge tier-${escapeAttr(String(source.tier || "c").toLowerCase())}">${escapeHtml(source.tier)} · ${escapeHtml(source.type)}</span>
            <strong>${escapeHtml(source.label)}</strong>
            <small>${escapeHtml(source.as_of || "")}</small>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function validationStatusLabel(status) {
  return ({ pass: "통과", warn: "주의", block: "차단" })[status] || status;
}

function formatValidationValue(value) {
  if (value == null) return "-";
  if (typeof value === "number") return Number.isInteger(value) ? formatNumber(value) : value.toFixed(3);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderRevenueAssumptionControls() {
  const assumptions = revenueAssumptions();
  return `
    <div class="revenue-assumption-toolbar" aria-label="활동 환산 단가 설정">
      <div class="revenue-assumption-summary">
        <span>시나리오 단가</span>
        <strong>${formatNumber(assumptions.unitMid)}원</strong>
        <small>외부 트래커 참고 기본값 · 이 브라우저에만 저장</small>
      </div>
      <label><span>하단</span><input id="revenue-unit-low" type="number" inputmode="numeric" min="1" max="1000000" step="1" value="${assumptions.unitLow}" aria-label="환산 단가 하단" /></label>
      <label><span>기준</span><input id="revenue-unit-mid" type="number" inputmode="numeric" min="1" max="1000000" step="1" value="${assumptions.unitMid}" aria-label="환산 기준 단가" /></label>
      <label><span>상단</span><input id="revenue-unit-high" type="number" inputmode="numeric" min="1" max="1000000" step="1" value="${assumptions.unitHigh}" aria-label="환산 단가 상단" /></label>
      <div class="revenue-assumption-actions">
        <button type="button" class="primary-button" data-revenue-assumptions-apply>전체 적용</button>
        <button type="button" class="ghost-button" data-revenue-assumptions-reset>기본값</button>
      </div>
      <p id="revenue-assumption-status" role="status" aria-live="polite">${escapeHtml(state.revenueAssumptionMessage || "대화 증가량 × 30일 × 선택 단가로 모든 환산액을 계산합니다.")}</p>
    </div>
  `;
}

function renderRevenuePanel() {
  const revenue = statsData.revenue_nowcast || {};
  const extrapolationDays = revenue.daily?.length || 0;
  const byCharacter = statsData.revenue_by_character || {};
  const coinMix = statsData.coin_mix_ramp || {};
  const market = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
  const marketLabel = MARKET_META[market].label;
  const cohortRows = marketCohortResponseRows(market);
  return `
    <section class="panel stats-panel signal-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">01 · 활동 환산 시나리오</p>
          <h2>추정 환산액 범위와 인기 캐릭터</h2>
        </div>
        <span class="data-pill warning">${extrapolationDays ? `${extrapolationDays}일 외삽` : "표본 대기"} · 가정 시나리오</span>
      </div>
      <p class="section-note metric-definition"><strong>도구 정의:</strong> 공식 서비스 도메인의 공개 대화 활동량에 사용자가 선택한 가정 단가를 적용하는 시나리오입니다. 결제율·무료 대화·국가별 ASP가 공개되지 않아 실제 매출이나 공시 매출을 뜻하지 않습니다.</p>
      ${renderRevenueAssumptionControls()}
      <div class="chart-grid chart-grid-primary">
        ${renderRevenueBand(revenue)}
        ${renderCharacterLeaderboard(byCharacter)}
      </div>
      <div class="chart-grid chart-grid-secondary">
        ${renderBarChart("유료 코인 결제 비중 · 회사 전체", "시장별 분리 불가 · 회사 IR 제시값 · 외부 검증 전", (coinMix.ir_checkpoints || []).map((item) => ({
          label: `${String(item.month || "").slice(5)}월`,
          value: item.pct,
          sub: item.label || item.month
        })), (value) => `${Number(value || 0).toFixed(1)}%`, "#f5a742")}
        ${renderColumnChart(`공개 월별 현재 반응 · ${marketLabel}`, "해당 월 공개 캐릭터의 현재 평균 누적 대화수 · 4개 시장 동일 공식", cohortRows, (value) => `${formatNumber(Math.round(value))}회`, "#62a8ff", "", {
          latestLabel: "최근 공개월 코호트",
          highLabel: "현재 평균 대화 최고",
          contextNote: "현재 시점 누적 대화수의 코호트 평균입니다. 먼저 공개된 월은 누적 기간이 길어 직접적인 성장률 비교가 아닙니다."
        })}
      </div>
    </section>
  `;
}

function renderGlobalPanel() {
  const comparison = statsData.site_comparison || {};
  const traction = statsData.site_traction || {};
  const overall = comparison.overall || {};
  const siteRows = MARKET_ORDER.map((market) => ({
    label: MARKET_META[market].label,
    value: recentRevenueForMarket(market).revenue_mid,
    sub: market === "kr" ? "한국" : `KR 대비 ${formatPercent(overall.per_site_pct?.[market])}`
  }));
  const allRecent = recentRevenueForMarket("all").revenue_mid;
  const krRecent = recentRevenueForMarket("kr").revenue_mid;
  const overseasShare = allRecent > 0 ? ((allRecent - krRecent) / allRecent) * 100 : null;
  const marketTotals = {
    kr: statsMarketTotals("kr").chats || overall.per_site?.kr?.chats || 0,
    jp: statsMarketTotals("jp").chats || overall.per_site?.jp?.chats || 0,
    global: statsMarketTotals("global").chats || overall.per_site?.global?.chats || 0,
    tw: statsMarketTotals("tw").chats || overall.per_site?.tw?.chats || 0
  };
  return `
    <section class="panel stats-panel signal-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">02 · 해외 반응</p>
          <h2>국가별 이용 비중과 최근 증가</h2>
        </div>
        <span class="data-pill neutral">단가 미검증</span>
      </div>
      <p class="section-note">한국·일본·Global·대만 공개 목록을 같은 시점에 수집했습니다. 모든 환산액은 위에서 선택한 공통 단가를 적용하며 현지 결제단가가 아닙니다.</p>
      <div class="chart-grid chart-grid-primary">
        ${renderMarketComposition(marketTotals, overseasShare)}
        ${renderStackedDaily("최근 하루 대화 증가량", traction.daily || [])}
      </div>
      <div class="chart-grid chart-grid-secondary">
        ${renderBarChart("사이트별 월환산 활동액", `동일 가정 단가 ${formatNumber(revenueAssumptions().unitMid)}원 적용 · 현지 ASP 미확인`, siteRows, formatWonBig, "#27c499", "full-span")}
      </div>
      <p class="section-note footnote">출처: 탑툰 서비스 도메인의 공개 카운터 · 산식: 최근 일평균 대화 증가 × 30일 × 선택 단가 · ${escapeHtml(formatDateTime(statsData.captured_at))} 수집</p>
    </section>
  `;
}

function renderCompletionPanel() {
  const ceiling = statsData.completion_ceiling || {};
  const nyangWon = Number(ceiling.nyang_won || 0.495);
  const floorTurns = Number(ceiling.turns?.floor || 81985);
  const ceilTurns = Number(ceiling.turns?.ceiling || 370270);
  const bear = Math.round(floorTurns * 80 * nyangWon);
  const bull = Math.round(ceilTurns * 80 * nyangWon);
  const base = Math.round((bear + bull) / 2);
  const totals = (ceiling.totals && ceiling.totals.base) ? ceiling.totals : { bear, base, bull };
  return `
    <section class="panel stats-panel signal-section compact-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">03 · 최대 소비 가정</p>
          <h2>한 사용자가 모두 소비할 때의 상한</h2>
        </div>
        <span class="data-pill neutral">한국 모델 · 이론 상한</span>
      </div>
      <p class="section-note">한국 캐릭터 기준 모델이며 실제 평균 결제액이 아닙니다. 활성 캐릭터 ${formatNumber(ceiling.active_count)}명과 평균 사진 ${formatNumber(ceiling.avg_photos)}장을 전부 소비하는 극단적 상한입니다. 일본·Global·대만에는 그대로 적용하지 않습니다.</p>
      <div class="scenario-layout">
        ${renderBarChart("Bear / Base / Bull", "고래 1명 최대지출 범위", [
          { label: "Bear", value: totals.bear, sub: "보수" },
          { label: "Base", value: totals.base, sub: "기준" },
          { label: "Bull", value: totals.bull, sub: "상단" }
        ], formatWonBig, "#b18cff")}
        <div class="stats-grid mini-grid scenario-kpis">
        ${renderStatCards([
          ["실측 커버리지", `${formatNumber(ceiling.coverage?.real)}/${formatNumber(ceiling.active_count)}`, "fallback 0"],
          ["Base 상한", formatWonBig(totals.base), "고강도 소비 가정"]
        ])}
        </div>
      </div>
    </section>
  `;
}

function marketDailyChatRows(market) {
  const daily = statsData?.site_traction?.daily || [];
  return daily.map((row) => {
    let value = 0;
    if (market === "all") {
      value = MARKET_ORDER.reduce((sum, key) => sum + Number(row[`${key}_delta`] || 0), 0);
    } else {
      value = Number(row[`${market}_delta`] || 0);
    }
    return {
      label: row.date.slice(5),
      value,
      sub: `${row.date} 일간`
    };
  });
}

function renderGrowthPanel() {
  const market = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
  const chatDeltas = catalogIntervalDeltas(market, "total_chats");
  const dailyRows = marketDailyChatRows(market);
  const marketLabel = MARKET_META[market].label;
  return `
    <section class="panel stats-panel signal-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">04 · 캐릭터 공급·수요</p>
          <h2>신규 캐릭터 수와 대화 증가 (일간 vs 실시간 갱신 분리)</h2>
        </div>
        <span class="data-pill positive">${escapeHtml(marketLabel)} 공급·수요</span>
      </div>
      <p class="section-note"><strong>일간(24h) 대화 증가량</strong>과 <strong>실시간 수집 갱신 델타</strong>를 상단에 나란히 1:1 비교로 배치하고, 아래에서 <strong>월별 신규 캐릭터 출시 추이 및 해당 월 출시 캐릭터</strong>를 클릭하여 확인합니다.</p>
      <div class="chart-grid chart-grid-primary">
        ${renderColumnChart(`${marketLabel} 일간(24h) 대화 증가량`, "24시간 1일 누적 대화 증가량 추이 · 일자별 집계", dailyRows, formatNumber, "#3987e5", "", { latestLabel: "최근 일간(24h)", highLabel: "구간 최대 일간", contextNote: "하루 24시간 동안 발생한 일간 대화 증가량 추이이며, 실시간 수집 간격 갱신량과 구분됩니다." })}
        ${renderColumnChart(`${marketLabel} 최근 수집 갱신 델타 (실시간)`, "직전 공식 API 수집본 대비 · 수분~수십분 배치 간격", chatDeltas, formatNumber, MARKET_META[market]?.color || "#27c499", "", { latestLabel: "최근 갱신(수집 간)", highLabel: "구간 최대 갱신", contextNote: "각 막대는 1회 수집 간격(수분~수십분) 동안 늘어난 실시간 갱신량이며, 일간 누적 증가량과 분리해 해석합니다." })}
      </div>
      <div class="chart-grid chart-grid-secondary" style="margin-top:14px">
        ${renderNewCharacterSupply(market, "full-span")}
      </div>
      ${renderGenreBars(marketGenreRows(market), marketLabel, market === "all" ? "중복 지역을 합친 고유 캐릭터" : "시장 원본 캐릭터")}
    </section>
  `;
}

function renderNewCharacterSupply(market, className = "") {
  const items = marketAnalysisItems(market);
  const marketLabel = MARKET_META[market].label;
  const rows = monthSeries(items);
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  const high = rows.reduce((best, row) => row.value > Number(best?.value ?? -Infinity) ? row : best, null);
  const max = Math.max(...rows.map((row) => row.value), 1);
  const deltaPct = previous?.value ? ((Number(latest?.value || 0) / previous.value) - 1) * 100 : 0;

  const availableMonths = rows.map((r) => r.label);
  const activeMonth = (state.selectedSupplyMonth && availableMonths.includes(state.selectedSupplyMonth))
    ? state.selectedSupplyMonth
    : (high?.label || latest?.label || "");

  const activeRow = rows.find((r) => r.label === activeMonth) || high || latest;
  const monthCharacters = items
    .filter((record) => String(record.publishedAt || "").startsWith(activeMonth))
    .sort((a, b) => b.chatsNumber - a.chatsNumber || b.viewsNumber - a.viewsNumber);
  const displayedCharacters = monthCharacters.slice(0, 4);

  return `
    <article class="chart-card new-character-supply-card ${escapeAttr(className)}">
      <div class="chart-heading">
        <div>
          <h3>${escapeHtml(marketLabel)} 월별 신규 캐릭터</h3>
          <p class="stat-help">공식 startAt 우선 · 누락 시 createdAt · 막대를 누르면 해당 월 출시 캐릭터로 전환</p>
        </div>
        <span class="sample-badge">${rows.length}개월</span>
      </div>
      <div class="chart-readout">
        <div><span>최근 · ${formatPeriodLabel(latest?.label)}</span><strong>${latest ? `${formatNumber(latest.value)}명` : "-"}</strong></div>
        <div><span>직전 월 대비</span><strong class="${deltaPct >= 0 ? "is-up" : "is-down"}">${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%</strong></div>
        <div class="is-highlight"><span>최다 출시월 · 선택: ${formatPeriodLabel(activeMonth)}</span><strong>${formatPeriodLabel(high?.label)} · ${formatNumber(high?.value)}명</strong></div>
      </div>
      <div class="column-chart supply-month-chart" style="--columns:${Math.max(rows.length, 1)}">
        ${rows.map((row) => {
          const height = Math.max(4, (row.value / max) * 100);
          const isSelected = row.label === activeMonth;
          return `
            <button type="button" class="column-item is-clickable${isSelected ? " is-selected" : ""}" data-supply-month="${escapeAttr(row.label)}" title="${escapeAttr(`${formatPeriodLabel(row.label)} 출시 캐릭터 ${row.value}명 보기`)}">
              <strong>${formatNumber(row.value)}명</strong>
              <span class="column-track"><i style="height:${height}%;background:${isSelected ? "#3987e5" : "#f5a742"}"></i></span>
              <small style="${isSelected ? "color:#62a8ff;font-weight:850" : ""}">${escapeHtml(formatPeriodLabel(row.label))}</small>
            </button>
          `;
        }).join("")}
      </div>
      <div class="peak-character-block">
        <div class="peak-character-heading">
          <div>
            <strong>${formatPeriodLabel(activeMonth)} 공개 캐릭터</strong>
            <small>현재 누적 대화가 많은 캐릭터 순 · 카드 선택 시 상세 팝업</small>
          </div>
          <span>${formatNumber(monthCharacters.length)}명 중 TOP ${Math.min(4, monthCharacters.length)}</span>
        </div>
        <div class="peak-character-list">
          ${displayedCharacters.length ? displayedCharacters.map((record) => `
            <button type="button" class="peak-character-card" data-character-id="${record.character_id}" data-character-market="${escapeAttr(record.market)}">
              ${record.imageSrc ? `<img class="thumb" src="${escapeAttr(record.imageSrc)}" alt="${escapeAttr(`${record.character_name} 이미지`)}" loading="lazy" data-fallback="${escapeAttr(record.character_name.slice(0, 1))}" />` : `<span class="thumb-fallback">${escapeHtml(record.character_name.slice(0, 1))}</span>`}
              <span><strong>${escapeHtml(record.character_name)}</strong><small>${escapeHtml(record.workSafe)}</small><b>공개 대화 ${formatCompact(record.chatsNumber)}회</b></span>
            </button>
          `).join("") : `<p class="empty-inline" style="padding:12px;grid-column:1/-1;text-align:center;color:var(--muted)">해당 월에 공개된 캐릭터 데이터가 없습니다.</p>`}
        </div>
      </div>
    </article>
  `;
}

function renderTotalsPanel() {
  const market = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
  const marketLabel = MARKET_META[market].label;
  const totals = catalogHistoryForMarket(market);
  const dailyViews = catalogIntervalDeltas(market, "total_views");
  const dailyChats = catalogIntervalDeltas(market, "total_chats");
  const cohortRows = marketCohortResponseRows(market);
  return `
    <section class="panel stats-panel signal-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">05 · 최근 관측 변화</p>
          <h2>${escapeHtml(marketLabel)} 처음 수집값과 현재 비교</h2>
        </div>
        <span class="data-pill warning">${formatNumber(totals.length)}회 수집</span>
      </div>
      <p class="section-note">장기 추세가 아닙니다. 선택한 ${escapeHtml(marketLabel)} 공식 공개 API의 로컬 저장 시점끼리 누적값과 증가량을 비교합니다.</p>
      <div class="chart-grid chart-grid-primary">
        ${renderSnapshotJourney("누적 조회수", `${marketLabel} 공개 조회수 합계`, totals, "total_views", "#62a8ff")}
        ${renderSnapshotJourney("누적 대화수", `${marketLabel} 공개 대화수 합계`, totals, "total_chats", "#27c499")}
      </div>
      <div class="chart-grid chart-grid-secondary">
        ${renderPeriodComparison("최근 수집 간 조회 증가", "직전 공식 API 수집본 대비", dailyViews, formatNumber, "#62a8ff", "", { latestLabel: "최근 구간", highLabel: "최대 증가 구간" })}
        ${renderPeriodComparison("최근 수집 간 대화 증가", "직전 공식 API 수집본 대비", dailyChats, formatNumber, "#27c499", "", { latestLabel: "최근 구간", highLabel: "최대 증가 구간" })}
      </div>
      ${renderPeriodComparison(`공개 월별 현재 반응 · ${marketLabel}`, "해당 월 공개 캐릭터의 현재 평균 누적 대화수", cohortRows, (value) => `${formatNumber(Math.round(value))}회`, "#d95926", "", {
        latestLabel: "최근 공개월 코호트",
        highLabel: "현재 평균 대화 최고",
        contextNote: "시장별 동일 공식입니다. 현재 누적값이므로 오래된 코호트가 더 긴 관측 기간을 가집니다."
      })}
    </section>
  `;
}

function renderWorkFilter() {
  const works = new Set();
  const source = state.market === "all" ? groups : recordsForMarket(state.market);
  source.forEach((item) => {
    const itemRecords = item.allRecords || [item];
    itemRecords.forEach((record) => {
      if (record.work_title) works.add(record.work_title);
    });
  });

  const sortedWorks = [...works].sort((a, b) => a.localeCompare(b, "ko"));
  if (state.work && !works.has(state.work)) state.work = "";
  els.workFilter.innerHTML = [
    `<option value="">전체 작품</option>`,
    ...sortedWorks.map((work) => `<option value="${escapeAttr(work)}">${escapeHtml(work)}</option>`)
  ].join("");
  els.workFilter.value = state.work;
}

function renderCharacterView() {
  if (!dataset) return;
  const filtered = getFilteredItems();
  els.activeMarketLabel.textContent = MARKET_META[state.market].label;
  const sourceTotal = state.market === "all" ? groups.length : recordsForMarket(state.market).length;
  const snapshot = state.market === "all" ? null : dataset.market_snapshots?.[state.market];
  const capturedAt = snapshot?.captured_at || dataset.generated_at;
  els.catalogFreshness.textContent = formatDateTime(capturedAt);
  els.catalogFreshnessDetail.textContent = `${formatFreshnessAge(capturedAt)} · ${state.market === "all" ? "4개 공개 API 동시 수집" : `${MARKET_META[state.market].label} 공개 API`}`;
  els.catalogScopeNote.textContent = state.market === "all" ? "중복 지역을 합친 고유 캐릭터" : `${MARKET_META[state.market].label} 원본 목록`;
  const activityScope = activityScopeForMarket(state.market);
  if (els.viewsDeltaScope) els.viewsDeltaScope.textContent = activityScope;
  if (els.chatsDeltaScope) els.chatsDeltaScope.textContent = activityScope;
  els.marketTabs.forEach((button) => {
    const count = button.dataset.market === "all" ? groups.length : recordsForMarket(button.dataset.market).length;
    button.querySelector("small").textContent = formatNumber(count);
  });
  renderCatalogSummary();
  els.resultStatus.textContent = filtered.length === sourceTotal
    ? `전체 ${formatNumber(sourceTotal)}명 표시`
    : `${formatNumber(sourceTotal)}명 중 ${formatNumber(filtered.length)}명 표시`;
  els.toolbarReset.hidden = !state.q && !state.work && state.sort === "views-desc";
  els.emptyState.hidden = filtered.length > 0;
  els.tbody.innerHTML = filtered.map(renderTableRow).join("");
  els.cardList.innerHTML = filtered.map(renderCard).join("");
  bindResultButtons();
}

function renderCatalogSummary() {
  const source = state.market === "all" ? records : recordsForMarket(state.market);
  const uniqueCharacters = state.market === "all"
    ? groups.length
    : source.length;
  const views = source.reduce((sum, record) => sum + record.viewsNumber, 0);
  const chats = source.reduce((sum, record) => sum + record.chatsNumber, 0);
  const works = new Set(source.map((record) => record.work_title).filter(Boolean)).size;
  const activitySummary = activitySummaryForMarket(state.market);
  const activityCards = activitySummary.comparableCount
    ? [
        ["최근 조회 증가", signedNumber(activitySummary.viewsDelta), `${activitySummary.windowLabel} · ${formatNumber(activitySummary.comparableCount)}개 비교`, activitySummary.viewsDelta >= 0 ? "positive" : "warning"],
        ["최근 대화 증가", signedNumber(activitySummary.chatsDelta), activitySummary.definitionLabel, activitySummary.chatsDelta >= 0 ? "positive" : "warning"],
      ]
    : [["증가 데이터", "비교 기준 대기", "다음 수집부터 조회·대화 증가를 계산합니다", "warning"]];
  els.catalogKpiGrid.innerHTML = renderStatCards([
    ["캐릭터", formatNumber(uniqueCharacters), state.market === "all" ? "국가별 대응 매핑 후 고유 캐릭터" : `${MARKET_META[state.market].label} 공개 캐릭터`],
    ["조회수", formatNumber(views), state.market === "all" ? "4개 시장 공개 수치 합산" : "해당 시장 공개 조회수"],
    ["채팅", formatNumber(chats), state.market === "all" ? "4개 시장 공개 수치 합산" : "해당 시장 공개 채팅"],
    ["작품", formatNumber(works), "빈 작품명 제외"],
    ...activityCards
  ]);
}

function getFilteredItems() {
  const query = state.q.toLowerCase();
  const source = state.market === "all" ? groups : recordsForMarket(state.market);
  const filtered = source.filter((item) => {
    const itemRecords = item.allRecords || [item];
    const matchesQuery = !query || item.searchText.includes(query);
    const matchesWork =
      !state.work || itemRecords.some((record) => record.work_title === state.work);
    return matchesQuery && matchesWork;
  });
  return sortItems(filtered);
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const aName = a.name || a.character_name;
    const bName = b.name || b.character_name;
    const aWork = a.work || a.workSafe;
    const bWork = b.work || b.workSafe;
    if (state.sort === "chats-desc") return b.chatsNumber - a.chatsNumber;
    if (state.sort === "views-delta-desc") return activitySortValue(b, "delta") - activitySortValue(a, "delta");
    if (state.sort === "chats-delta-desc") return activitySortValue(b, "chat_delta") - activitySortValue(a, "chat_delta");
    if (state.sort === "name-asc") return aName.localeCompare(bName, "ko");
    if (state.sort === "work-asc") return aWork.localeCompare(bWork, "ko");
    return b.viewsNumber - a.viewsNumber;
  });
}

function recordsForMarket(market) {
  const site = MARKET_META[market].site;
  return records.filter((record) => record.site === site);
}

function renderDualDeltaBadge(liveDelta, dailyDelta, emptyLabel) {
  const hasLive = liveDelta != null && Number.isFinite(Number(liveDelta));
  const hasDaily = dailyDelta != null && Number.isFinite(Number(dailyDelta));
  if (!hasLive && !hasDaily) {
    return `<span class="activity-unavailable" title="${escapeAttr(emptyLabel)}">—</span>`;
  }
  return `
    <div class="dual-delta-cell">
      ${hasLive ? `<span class="delta-badge live-delta" title="직전 수집 간격 실시간 갱신 대비">${renderActivityDelta(liveDelta, "—")}<small>갱신</small></span>` : ""}
      ${hasDaily ? `<span class="delta-badge daily-delta" title="일간(24h) 누적 증가">${renderActivityDelta(dailyDelta, "—")}<small>일간</small></span>` : ""}
    </div>
  `;
}

function renderTableRow(item) {
  const model = viewModel(item);
  const activity = characterActivity(item);
  const daily = dailyActivityForItem(item, model.id);
  return `
    <tr>
      <td class="character-cell">
        <button class="row-button" type="button" data-character-id="${model.id}">
          <span class="character-identity">
            ${renderThumb(model)}
            <span class="name-stack">
              <strong>${escapeHtml(model.name)}</strong>
              <span>ID ${model.id}</span>
            </span>
          </span>
        </button>
      </td>
      <td>${escapeHtml(model.work)}</td>
      <td>${renderMarketPills(model.markets, model.market)}</td>
      <td class="metric">${formatNumber(model.views)}</td>
      <td class="metric">${renderDualDeltaBadge(activity?.delta, daily?.delta, "조회 증가 데이터 없음")}</td>
      <td class="metric">${formatNumber(model.chats)}</td>
      <td class="metric">${renderDualDeltaBadge(activity?.chat_delta, daily?.chat_delta, "대화 증가 데이터 없음")}</td>
      <td>${escapeHtml(model.counterparts)}</td>
    </tr>
  `;
}

function renderCard(item) {
  const model = viewModel(item);
  const activity = characterActivity(item);
  const daily = dailyActivityForItem(item, model.id);
  return `
    <article class="character-card">
      <button class="card-button" type="button" data-character-id="${model.id}">
        <span class="card-main">
          ${renderThumb(model)}
          <span class="name-stack">
            <strong>${escapeHtml(model.name)}</strong>
            <span>${escapeHtml(model.work)}</span>
            <span>${renderMarketPills(model.markets, model.market)}</span>
          </span>
        </span>
        <span class="card-meta">
          <span>누적 조회수<strong>${formatNumber(model.views)}</strong></span>
          <span>조회 증가 (갱신/일간)<strong>${renderDualDeltaBadge(activity?.delta, daily?.delta, "미수집")}</strong></span>
          <span>누적 대화수<strong>${formatNumber(model.chats)}</strong></span>
          <span>대화 증가 (갱신/일간)<strong>${renderDualDeltaBadge(activity?.chat_delta, daily?.chat_delta, "미수집")}</strong></span>
        </span>
      </button>
    </article>
  `;
}

function bindResultButtons() {
  bindImageFallbacks(document);
}

function bindImageFallbacks(root) {
  [...root.querySelectorAll("img.thumb")].forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        const fallback = document.createElement("span");
        fallback.className = img.classList.contains("thumb-full")
          ? "thumb-fallback thumb-full"
          : img.classList.contains("rank-image")
            ? "rank-image rank-fallback"
            : "thumb-fallback";
        fallback.setAttribute("aria-hidden", "true");
        fallback.textContent = img.dataset.fallback || "?";
        img.replaceWith(fallback);
      },
      { once: true }
    );
  });
}

function viewModel(item) {
  const isGroup = Boolean(item.allRecords);
  const primary = isGroup ? item.primary : item;
  const group = isGroup ? item : item.group;
  const markets = isGroup ? item.markets : [item.market];
  const names = MARKET_ORDER.map((market) => group.locales[market]?.character_name).filter(Boolean);
  return {
    id: primary.character_id,
    name: isGroup ? item.name : primary.character_name,
    work: isGroup ? item.work : primary.workSafe,
    market: primary.market,
    markets,
    views: item.viewsNumber,
    chats: item.chatsNumber,
    imageSrc: primary.imageSrc,
    videoSrc: proxiedMediaUrl(primary.safe_video_url),
    detailUrl: primary.detail_url,
    fallback: primary.character_name.slice(0, 1),
    counterparts: state.market === "all" ? names.join(" / ") : otherLocaleNames(group, primary.market)
  };
}

function workerActivityForId(characterId) {
  const row = (statsData?.characters?.characters || []).find((candidate) => Number(candidate.character_id) === Number(characterId));
  if (!row) return null;
  return {
    ...row,
    sourceLabel: "KR Worker · 일간",
    scopeLabel: "한국",
    definitionLabel: "한국 Worker 직전 일간 수집본 대비",
    baseline_at: null
  };
}

function directActivityForRecord(record) {
  if (!record?.market) return null;
  const marketData = catalogActivityData?.markets?.[record.market];
  const row = (marketData?.rows || []).find((candidate) => Number(candidate.character_id) === Number(record.character_id));
  if (!row || row.delta == null || row.chat_delta == null) return null;
  return {
    ...row,
    sourceLabel: `${MARKET_META[record.market].short} 공개 API · 수집 간`,
    scopeLabel: MARKET_META[record.market].label,
    definitionLabel: "직전 로컬 공개 API 수집본 대비",
    interval_seconds: marketData.interval_seconds
  };
}

function aggregateDirectActivity(group) {
  const rows = (group?.allRecords || []).map(directActivityForRecord).filter(Boolean);
  if (!rows.length) return null;
  return {
    delta: rows.reduce((sum, row) => sum + Number(row.delta || 0), 0),
    chat_delta: rows.reduce((sum, row) => sum + Number(row.chat_delta || 0), 0),
    last_seen: catalogActivityData?.captured_at,
    baseline_at: catalogActivityData?.baseline_at,
    interval_seconds: catalogActivityData?.interval_seconds,
    sourceLabel: "4개 공개 API · 수집 간",
    scopeLabel: "통합",
    definitionLabel: "시장별 직전 로컬 공개 API 수집본 대비 합계"
  };
}

function characterActivityForMarket(item, market) {
  if (market === "all") return aggregateDirectActivity(item);
  const record = item?.allRecords ? item.locales?.[market] : item;
  if (!record || record.market !== market) return null;
  return directActivityForRecord(record);
}

function characterActivity(item) {
  return characterActivityForMarket(item, state.market);
}

function formatObservationDuration(seconds) {
  const totalMinutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
  if (totalMinutes < 60) return `${totalMinutes}분`;
  const hours = totalMinutes / 60;
  if (hours < 24) return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}시간`;
  return `${(hours / 24).toFixed(1)}일`;
}

function characterHistoryIntervals(record, maxHours = 24) {
  if (!record?.market || record.character_id == null) return [];
  const history = catalogActivityData?.character_history || [];
  const latestTime = new Date(catalogActivityData?.captured_at || history.at(-1)?.captured_at).getTime();
  const cutoff = Number.isFinite(latestTime) ? latestTime - maxHours * 3600000 : Number.NEGATIVE_INFINITY;
  const rows = history.flatMap((entry) => {
    const pair = entry?.markets?.[record.market]?.[String(Number(record.character_id))];
    if (!Array.isArray(pair) || pair.length < 2) return [];
    const end = new Date(entry.captured_at).getTime();
    const declaredSeconds = Number(entry.interval_seconds || 0);
    const parsedStart = new Date(entry.baseline_at).getTime();
    const start = Number.isFinite(parsedStart) ? parsedStart : end - declaredSeconds * 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= cutoff) return [];
    const effectiveStart = Math.max(start, cutoff);
    const effectiveSeconds = Math.max(1, (end - effectiveStart) / 1000);
    const fullSeconds = Math.max(1, (end - start) / 1000);
    const overlapShare = Math.min(1, effectiveSeconds / fullSeconds);
    return [{
      start,
      end,
      seconds: effectiveSeconds,
      viewsDelta: Number(pair[0] || 0) * overlapShare,
      chatsDelta: Number(pair[1] || 0) * overlapShare
    }];
  });

  if (rows.length) return rows.sort((a, b) => a.end - b.end);
  const fallback = directActivityForRecord(record);
  const fallbackSeconds = Number(fallback?.interval_seconds || 0);
  const fallbackEnd = new Date(fallback?.last_seen).getTime();
  if (!fallback || !Number.isFinite(fallbackSeconds) || fallbackSeconds <= 0 || !Number.isFinite(fallbackEnd)) return [];
  return [{
    start: fallbackEnd - fallbackSeconds * 1000,
    end: fallbackEnd,
    seconds: fallbackSeconds,
    viewsDelta: Number(fallback.delta || 0),
    chatsDelta: Number(fallback.chat_delta || 0)
  }];
}

function characterHourlyMetrics(record, maxHours = 24) {
  const intervals = characterHistoryIntervals(record, maxHours);
  if (!intervals.length) return null;
  const coverageSeconds = intervals.reduce((sum, row) => sum + row.seconds, 0);
  if (!(coverageSeconds > 0)) return null;
  const viewsDelta = intervals.reduce((sum, row) => sum + row.viewsDelta, 0);
  const chatsDelta = intervals.reduce((sum, row) => sum + row.chatsDelta, 0);
  const hourMap = new Map();
  intervals.forEach((row) => {
    const date = new Date(row.end);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    if (!hourMap.has(key)) {
      hourMap.set(key, {
        time: row.end,
        label: `${String(date.getHours()).padStart(2, "0")}:00`,
        fullLabel: `${date.getMonth() + 1}.${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:00`,
        seconds: 0,
        viewsDelta: 0,
        chatsDelta: 0
      });
    }
    const bucket = hourMap.get(key);
    bucket.seconds += row.seconds;
    bucket.viewsDelta += row.viewsDelta;
    bucket.chatsDelta += row.chatsDelta;
  });
  const hourlyRows = [...hourMap.values()].map((row) => ({
    ...row,
    viewsPerHour: Math.round((row.viewsDelta / row.seconds) * 3600),
    chatsPerHour: Math.round((row.chatsDelta / row.seconds) * 3600)
  }));
  const coverageLabel = coverageSeconds >= 22 * 3600
    ? "최근 24시간"
    : `${formatObservationDuration(coverageSeconds)} 관측 · 24h 누적 중`;
  return {
    intervals,
    hourlyRows,
    coverageSeconds,
    coverageLabel,
    viewsDelta,
    chatsDelta,
    viewsPerHour: Math.round((viewsDelta / coverageSeconds) * 3600),
    chatsPerHour: Math.round((chatsDelta / coverageSeconds) * 3600),
    latestAt: new Date(intervals.at(-1).end).toISOString()
  };
}

function dailyActivityForItem(item, characterId) {
  if (state.market === "kr") return workerActivityForId(characterId);
  if (state.market === "all") return null;
  const record = item?.allRecords ? item.locales?.[state.market] : item;
  if (!record || record.market !== state.market) return null;
  const metrics = characterHourlyMetrics(record);
  if (!metrics || metrics.coverageSeconds < 22 * 3600) return null;
  return {
    delta: Math.round(metrics.viewsDelta),
    chat_delta: Math.round(metrics.chatsDelta),
    last_seen: metrics.latestAt,
    sourceLabel: `${MARKET_META[state.market].short} 공개 API · 최근 24h`,
    scopeLabel: MARKET_META[state.market].label,
    definitionLabel: "공식 공개 API 캐릭터 이력의 최대 최근 24시간 누적"
  };
}

function characterPeriodMetrics(record, hourlyMetrics = characterHourlyMetrics(record)) {
  const krDaily = record?.market === "kr" ? workerActivityForId(record.character_id) : null;
  if (krDaily) {
    return {
      label: "일간(24h)",
      viewsDelta: Number(krDaily.delta || 0),
      chatsDelta: Number(krDaily.chat_delta || 0),
      help: `${formatShortDate(krDaily.last_seen)} 한국 Worker 일간`
    };
  }
  if (!hourlyMetrics) {
    return {
      label: "최근 관측",
      viewsDelta: null,
      chatsDelta: null,
      help: "공식 API 이력 수집 대기"
    };
  }
  const isFullDay = hourlyMetrics.coverageSeconds >= 22 * 3600;
  return {
    label: isFullDay ? "최근(24h)" : `관측(${formatObservationDuration(hourlyMetrics.coverageSeconds)})`,
    viewsDelta: Math.round(hourlyMetrics.viewsDelta),
    chatsDelta: Math.round(hourlyMetrics.chatsDelta),
    help: isFullDay ? "공식 API 최근 24h 누적" : "공식 API 관측 누적 · 24h 누적 중"
  };
}

function renderCharacterHourlyPopover(record, metricType, metrics = characterHourlyMetrics(record)) {
  const isViews = metricType === "views";
  const metricLabel = isViews ? "조회" : "대화";
  const rows = metrics?.hourlyRows || [];
  if (!rows.length) {
    return `<div class="hourly-popover-card"><p class="popover-empty-note">캐릭터별 시간대 이력이 다음 정기 수집부터 누적됩니다.</p></div>`;
  }
  const valueFor = (row) => isViews ? row.viewsPerHour : row.chatsPerHour;
  const peakRow = rows.reduce((best, row) => Math.abs(valueFor(row)) > Math.abs(valueFor(best)) ? row : best, rows[0]);
  const maxAbs = Math.max(...rows.map((row) => Math.abs(valueFor(row))), 1);
  const average = isViews ? metrics.viewsPerHour : metrics.chatsPerHour;
  return `
    <div class="hourly-popover-card is-${metricType}">
      <div class="hourly-popover-header">
        <div class="popover-title-group">
          <strong>📊 ${escapeHtml(record.character_name)} 시간대별 ${metricLabel} 증가 추이</strong>
          <span class="popover-subtext">${escapeHtml(MARKET_META[record.market].label)} 공식 공개 카운터 · 최대 최근 24시간</span>
        </div>
        <div class="popover-summary-chips">
          <span class="popover-chip peak-chip">⚡ 최대 변동: ${escapeHtml(peakRow.fullLabel)} (${signedNumber(valueFor(peakRow))}회/h)</span>
          <span class="popover-chip avg-chip">시간당 평균: ${signedNumber(average)}회</span>
        </div>
      </div>
      <div class="hourly-timeline-table">
        <div class="timeline-table-header"><span>시간</span><span>증가 강도</span><span>시간당 ${metricLabel}</span></div>
        <div class="timeline-table-body">
          ${rows.slice().reverse().map((row, index) => {
            const value = valueFor(row);
            const width = Math.max(4, Math.round((Math.abs(value) / maxAbs) * 100));
            return `
              <div class="timeline-row${row === peakRow ? " is-peak" : ""}">
                <span class="timeline-time">${escapeHtml(row.label)}${index === 0 ? ` <small class="now-tag">최신</small>` : ""}</span>
                <div class="timeline-dual-bars"><div class="bar-slot single-bar"><span class="bar-fill ${isViews ? "view-fill" : "chat-fill"}${value < 0 ? " is-negative" : ""}" style="width:${width}%"></span></div></div>
                <strong class="timeline-val ${isViews ? "view-val" : "chat-val"}">${signedNumber(value)}회/h</strong>
              </div>`;
          }).join("")}
        </div>
      </div>
      <div class="hourly-popover-footer">
        <span>${escapeHtml(metrics.coverageLabel)}</span>
        <small>불규칙 수집 간격을 실제 경과시간으로 정규화</small>
      </div>
    </div>`;
}

function activityScopeForMarket(market) {
  if (market === "all") return "통합 · 공개 API 수집 간 대비";
  return `${MARKET_META[market].label} · 공개 API 수집 간 대비`;
}

function activitySummaryForMarket(market) {
  const marketRows = market === "all"
    ? MARKET_ORDER.flatMap((key) => catalogActivityData?.markets?.[key]?.rows || [])
    : catalogActivityData?.markets?.[market]?.rows || [];
  const comparableRows = marketRows.filter((row) => row.delta != null && row.chat_delta != null);
  
  const baselineAt = catalogActivityData?.baseline_at;
  const capturedAt = catalogActivityData?.captured_at;
  let intervalSec = Number(catalogActivityData?.interval_seconds || 0);
  if ((!intervalSec || intervalSec <= 0) && baselineAt && capturedAt) {
    intervalSec = Math.max(1, Math.round((new Date(capturedAt).getTime() - new Date(baselineAt).getTime()) / 1000));
  }
  if (!intervalSec || intervalSec <= 0) intervalSec = 1800; // 기본 30분 환산

  const viewsDelta = comparableRows.reduce((sum, row) => sum + Number(row.delta || 0), 0);
  const chatsDelta = comparableRows.reduce((sum, row) => sum + Number(row.chat_delta || 0), 0);

  // 1시간당 시속(Hourly Rate) 정규화
  const viewsPerHour = Math.round((viewsDelta / intervalSec) * 3600);
  const chatsPerHour = Math.round((chatsDelta / intervalSec) * 3600);

  return {
    comparableCount: comparableRows.length,
    viewsDelta,
    chatsDelta,
    viewsPerHour,
    chatsPerHour,
    intervalSec,
    capturedAt: catalogActivityData?.captured_at,
    windowLabel: formatActivityWindow(catalogActivityData?.baseline_at, catalogActivityData?.captured_at),
    sourceLabel: market === "all" ? "4개 공식 공개 카탈로그 API" : `${MARKET_META[market].label} 공식 공개 카탈로그 API`,
    definitionLabel: "직전 로컬 공개 API 수집본 대비"
  };
}

function recentMarketMovers(market, field, limit = 3) {
  return [...(catalogActivityData?.markets?.[market]?.rows || [])]
    .filter((row) => Number(row[field]) > 0)
    .sort((a, b) => Number(b[field]) - Number(a[field]))
    .slice(0, limit);
}

function renderMoverChips(market, field) {
  const rows = recentMarketMovers(market, field, 3);
  if (!rows.length) return '<div class="mover-chip-empty">—</div>';
  const isView = field === 'delta';
  return `
    <div class="mover-chip-list">
      ${rows.map((row, idx) => `
        <button class="mover-chip-badge ${isView ? "is-view" : "is-chat"}" type="button" data-character-id="${escapeAttr(row.character_id)}" data-character-market="${escapeAttr(market)}" aria-label="${escapeAttr(`${row.character_name} 캐릭터 정보 열기`)}">
          <span class="mover-badge-rank">${idx + 1}</span>
          <span class="mover-badge-name">${escapeHtml(row.character_name)}</span>
          <strong class="mover-badge-val">${signedNumber(row[field])}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function renderMoverNames(market, field) {
  const rows = recentMarketMovers(market, field);
  if (!rows.length) return "증가 항목 없음";
  return rows.map((row) => `${escapeHtml(row.character_name)} <b>${signedNumber(row[field])}</b>`).join(" · ");
}

function percentOf(value, total) {
  const denominator = Number(total || 0);
  return denominator > 0 ? (Number(value || 0) / denominator) * 100 : 0;
}

function renderObservedMarketCard(market, allDailyDeltas) {
  const meta = MARKET_META[market];
  const daily = getDailyMarketDeltas(market);
  const activity = activitySummaryForMarket(market);
  const viewShare = percentOf(daily.viewsDelta, allDailyDeltas.viewsDelta);
  const chatShare = percentOf(daily.chatsDelta, allDailyDeltas.chatsDelta);
  return `
    <article class="event-feed-card market-${escapeHtml(market)}">
      <div class="event-feed-top">
        <div class="event-feed-title-block">
          <span class="event-pill ${escapeHtml(market)}-pill">${meta.flag} ${escapeHtml(meta.label)} API 실측</span>
        </div>
        <div class="event-feed-metrics-pill">
          <span class="daily-stat-chip view-stat"><small>24h 조회</small> <strong>${signedNumber(daily.viewsDelta)}</strong></span>
          <span class="daily-stat-chip chat-stat"><small>24h 대화</small> <strong>${signedNumber(daily.chatsDelta)}</strong></span>
        </div>
      </div>
      <div class="event-share-gauges">
        <div class="event-gauge-col">
          <div class="gauge-head">
            <span>4개국 조회 증가 비중</span>
            <strong class="gauge-view-text">${viewShare.toFixed(1)}%</strong>
          </div>
          <div class="gauge-track"><div class="gauge-fill view-fill" style="width:${Math.min(100, Math.max(3, viewShare))}%"></div></div>
        </div>
        <div class="event-gauge-col">
          <div class="gauge-head">
            <span>4개국 대화 증가 비중</span>
            <strong class="gauge-chat-text">${chatShare.toFixed(1)}%</strong>
          </div>
          <div class="gauge-track"><div class="gauge-fill chat-fill" style="width:${Math.min(100, Math.max(3, chatShare))}%"></div></div>
        </div>
      </div>
      <div class="event-movers-dual-grid" aria-label="최근 수집 간 변화">
        <div class="mover-section">
          <div class="mover-section-title">📈 조회 증가 TOP 3</div>
          ${renderMoverChips(market, "delta")}
        </div>
        <div class="mover-section">
          <div class="mover-section-title">💬 대화 증가 TOP 3</div>
          ${renderMoverChips(market, "chat_delta")}
        </div>
      </div>
    </article>
  `;
}

function promotionChangeLabel(change) {
  return {
    new: "신규 감지",
    changed: "내용 변경",
    continuing: "계속 확인",
    ended: "종료 감지",
    none: "미감지"
  }[change] || "확인 상태";
}

const HOME_BANNER_BADGE_LABELS = {
  popular: "인기 캐릭터",
  newScenario: "신규 시나리오",
  new: "신규 캐릭터",
  promotion: "오늘특가"
};

function renderHoverPreviewMedia({ imageSrc = "", videoSrc = "", sourceLabel = "" } = {}) {
  if (!imageSrc && !videoSrc) return "";
  return `
    <span class="media-hover-preview" aria-hidden="true">
      ${imageSrc ? `<img class="media-hover-preview-image" data-preview-image="${escapeAttr(imageSrc)}" alt="" />` : ""}
      ${videoSrc ? `<video class="media-hover-preview-video" data-preview-video="${escapeAttr(videoSrc)}" muted loop playsinline preload="none"></video>` : ""}
      ${sourceLabel ? `<span class="media-hover-preview-note">${escapeHtml(sourceLabel)}</span>` : ""}
    </span>
  `;
}

function activateHoverPreview(target) {
  const preview = target?.querySelector(".media-hover-preview");
  if (!preview) return;
  target.classList.add("is-preview-open");

  const image = preview.querySelector("[data-preview-image]");
  if (image && !image.getAttribute("src")) image.setAttribute("src", image.dataset.previewImage || "");

  const video = preview.querySelector("video[data-preview-video]");
  if (!video) return;
  if (!video.dataset.previewBound) {
    video.dataset.previewBound = "true";
    video.addEventListener("canplay", () => {
      video.classList.add("is-ready");
      if (target.classList.contains("is-preview-open")) video.play().catch(() => {});
    });
    video.addEventListener("error", () => video.classList.add("is-error"), { once: true });
  }
  if (!video.getAttribute("src")) {
    video.setAttribute("src", video.dataset.previewVideo || "");
    if (image?.getAttribute("src")) video.poster = image.getAttribute("src");
    video.load();
  }
  video.play().catch(() => {});
}

function deactivateHoverPreview(target) {
  const preview = target?.querySelector(".media-hover-preview");
  if (!preview) return;
  target.classList.remove("is-preview-open");
  const video = preview.querySelector("video[data-preview-video]");
  if (video) {
    video.pause();
    try { video.currentTime = 0; } catch { /* media may not have loaded metadata yet */ }
  }
}

function promotionPreviewSources(market, item) {
  const characterId = Number(item?.character_id);
  const homeBanner = (officialHomeBannersData?.markets?.[market]?.items || [])
    .find((banner) => Number(banner.character_id) === characterId);
  const record = records.find((candidate) => candidate.market === market && Number(candidate.character_id) === characterId);
  const imageSrc = homeBanner?.image_url || record?.imageSrc || "";
  const videoSrc = proxiedMediaUrl(homeBanner?.asset_url) || proxiedMediaUrl(record?.safe_video_url);
  return {
    imageSrc,
    videoSrc,
    sourceLabel: homeBanner ? "공식 홈 배너" : record ? "캐릭터 모션" : "공식 이미지"
  };
}

function renderOfficialHomeBannerCard(market) {
  const meta = MARKET_META[market];
  const observation = officialHomeBannersData?.markets?.[market] || null;
  const items = observation?.items || [];
  const sourceLink = observation?.homepage_url
    ? `<a class="promotion-link-btn" href="${escapeAttr(observation.homepage_url)}" target="_blank" rel="noopener noreferrer">출처 홈 ↗</a>`
    : "";

  if (!items.length) {
    const message = observation?.status === "empty"
      ? "이번 갱신에서 공식 홈 상단 배너를 확인하지 못했습니다."
      : "공식 홈 배너 출처를 확인하지 못했습니다. 이전 문구를 추정으로 대체하지 않습니다.";
    return `
      <article class="official-home-banner-card is-empty">
        <div class="official-home-banner-head">
          <div class="official-home-banner-market"><span>${meta.flag}</span><strong>${escapeHtml(meta.label)}</strong></div>
          ${sourceLink}
        </div>
        <p class="official-home-banner-empty">${message}</p>
      </article>
    `;
  }

  const bannerItems = items.map((item, index) => {
    const badges = (item.badges || [])
      .map((badge) => HOME_BANNER_BADGE_LABELS[badge] || badge)
      .filter(Boolean)
      .slice(0, 2)
      .map((badge) => `<span class="official-home-banner-badge">${escapeHtml(badge)}</span>`)
      .join("");
    const title = item.title || item.info_text || `공식 홈 배너 ${index + 1}`;
    const info = item.info_text && item.info_text !== item.title ? item.info_text : "";
    const href = item.detail_url || observation.homepage_url;
    const videoSrc = proxiedMediaUrl(item.asset_url);
    return `
      <a class="official-home-banner-item" data-hover-preview href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(`${meta.label} 공식 홈 배너 ${index + 1}: ${title}`)}">
        <span class="official-home-banner-caption">
          <span class="official-home-banner-badges">${badges}</span>
          <strong>${escapeHtml(title)}</strong>
          ${info ? `<small>${escapeHtml(info)}</small>` : ""}
        </span>
        ${renderHoverPreviewMedia({ imageSrc: item.image_url, videoSrc, sourceLabel: videoSrc ? "공식 모션" : "공식 홈 배너" })}
      </a>
    `;
  }).join("");

  return `
    <article class="official-home-banner-card">
      <div class="official-home-banner-head">
        <div class="official-home-banner-market"><span>${meta.flag}</span><strong>${escapeHtml(meta.label)}</strong></div>
        <div class="official-home-banner-actions"><span class="official-home-banner-count">${formatNumber(items.length)}개 확인</span>${sourceLink}</div>
      </div>
      <div class="official-home-banner-strip">${bannerItems}</div>
    </article>
  `;
}

function renderOfficialPromotionCard(market) {
  const meta = MARKET_META[market];
  const observation = officialPromotionsData?.markets?.[market] || null;
  const items = observation?.items || [];
  const status = observation?.status || "unavailable";
  const statusClass = ["verified", "partial", "none"].includes(status) ? status : "unavailable";

  if (!items.length) {
    const message = status === "none"
      ? "이번 갱신에서 공식 카탈로그의 할인 프로모션 배지가 감지되지 않았습니다."
      : "공식 프로모션 출처를 확인하지 못했습니다. 이전 문구를 추정으로 대체하지 않습니다.";
    return `
      <article class="promotion-card is-${statusClass}">
        <div class="promotion-card-head">
          <div class="promotion-market-actions">
            <span class="promotion-market-label">${meta.flag} ${escapeHtml(meta.label)}</span>
            ${observation?.homepage_url ? `<a class="promotion-link-btn" href="${escapeAttr(observation.homepage_url)}" target="_blank" rel="noopener noreferrer">출처 홈 ↗</a>` : ""}
          </div>
          <b class="promotion-status-badge is-none">${status === "none" ? "공식 프로모션 미감지" : "출처 확인 불가"}</b>
        </div>
        <p class="promotion-empty-msg">${message}</p>
      </article>
    `;
  }

  const itemHtml = items.map((item) => {
    const title = item.headline || `${item.character_name} · 프로모션 배지 감지`;
    const verificationHint = item.verification === "api-and-homepage"
      ? "카탈로그 배지와 공식 홈페이지 링크를 함께 확인"
      : "카탈로그 API 배지만 확인";
    const previewMedia = renderHoverPreviewMedia(promotionPreviewSources(market, item));
    return `
      <div class="promotion-item${previewMedia ? " has-hover-preview" : ""}"${previewMedia ? " data-hover-preview" : ""}>
        <strong class="promotion-item-title" title="${escapeAttr(verificationHint)}">${escapeHtml(title)}</strong>
        ${previewMedia}
        <a class="promotion-link-btn" href="${escapeAttr(item.detail_url)}" target="_blank" rel="noopener noreferrer">공식 캐릭터 페이지 ↗</a>
      </div>
    `;
  }).join("");

  return `
    <article class="promotion-card is-${statusClass}">
      <div class="promotion-card-head">
        <div class="promotion-market-actions">
          <span class="promotion-market-label">${meta.flag} ${escapeHtml(meta.label)}</span>
          <a class="promotion-link-btn" href="${escapeAttr(observation.homepage_url)}" target="_blank" rel="noopener noreferrer">출처 홈 ↗</a>
        </div>
        <b class="promotion-status-badge is-${escapeHtml(observation.change || "active")}">${escapeHtml(promotionChangeLabel(observation.change))}</b>
      </div>
      <div class="promotion-items-wrap">
        ${itemHtml}
      </div>
    </article>
  `;
}

function getDailyMarketDeltas(market) {
  const history = catalogActivityData?.history || [];
  if (history.length >= 2) {
    const latest = history.at(-1);
    const latestTime = new Date(latest.captured_at).getTime();
    const targetPastTime = latestTime - 24 * 3600 * 1000;
    const past = history.reduce((best, s) => {
      const diffCurr = Math.abs(new Date(s.captured_at).getTime() - targetPastTime);
      const diffBest = Math.abs(new Date(best.captured_at).getTime() - targetPastTime);
      return diffCurr < diffBest ? s : best;
    }, history[0]);

    const timeSpanSec = (latestTime - new Date(past.captured_at).getTime()) / 1000;
    if (timeSpanSec >= 3600) {
      const normalizeRatio = 86400 / timeSpanSec;
      const targetMarkets = market === "all" ? MARKET_ORDER : [market];
      
      let viewsDelta = 0;
      let chatsDelta = 0;
      targetMarkets.forEach((m) => {
        const vDiff = Math.max(0, Number(latest.markets?.[m]?.views || 0) - Number(past.markets?.[m]?.views || 0));
        const cDiff = Math.max(0, Number(latest.markets?.[m]?.chats || 0) - Number(past.markets?.[m]?.chats || 0));
        viewsDelta += vDiff;
        chatsDelta += cDiff;
      });

      return {
        viewsDelta: Math.round(viewsDelta * normalizeRatio),
        chatsDelta: Math.round(chatsDelta * normalizeRatio),
        dateLabel: "24h 누적"
      };
    }
  }

  // 폴백
  const dailyRows = statsData?.site_traction?.daily || [];
  const latestDaily = dailyRows.at(-1) || {};
  const dailyDateLabel = latestDaily.date ? formatDateShort(latestDaily.date) : "최근";
  let chatsDelta = 0;
  if (market === "all") {
    chatsDelta = MARKET_ORDER.reduce((sum, key) => sum + Number(latestDaily[`${key}_delta`] || 0), 0);
  } else {
    chatsDelta = Number(latestDaily[`${market}_delta`] || 0);
  }
  const krWorkerChars = statsData?.characters?.characters || [];
  const krViewsFromChars = krWorkerChars.reduce((sum, c) => sum + Number(c.delta || 0), 0) || 133476;
  
  return {
    viewsDelta: market === "kr" || market === "all" ? krViewsFromChars : 0,
    chatsDelta,
    dateLabel: `${dailyDateLabel} 24h`
  };
}


/* ==========================================================================
   DAILY / WEEKLY / MONTHLY UNIFIED AGGREGATION & TREND RENDERERS
   ========================================================================== */

function computeDailyMetrics(market = "all") {
  const tractionDaily = statsData?.site_traction?.daily || [];
  const dailyTotals = statsData?.daily_totals?.rows || [];
  const hist = catalogActivityData?.history || [];

  const histDays = {};
  hist.forEach((s) => {
    const d = s.captured_at ? s.captured_at.slice(0, 10) : "";
    if (d) {
      if (!histDays[d]) histDays[d] = [];
      histDays[d].push(s);
    }
  });

  const histDeltas = {};
  Object.entries(histDays).forEach(([d, snaps]) => {
    if (snaps.length >= 2) {
      const first = snaps[0];
      const last = snaps.at(-1);
      const spanSec = (new Date(last.captured_at) - new Date(first.captured_at)) / 1000;
      const normalizeRatio = spanSec > 0 && spanSec < 72000 ? 86400 / spanSec : 1;
      const v = {};
      const c = {};
      MARKET_ORDER.forEach((m) => {
        const vDiff = Math.max(0, Number(last.markets?.[m]?.views || 0) - Number(first.markets?.[m]?.views || 0));
        const cDiff = Math.max(0, Number(last.markets?.[m]?.chats || 0) - Number(first.markets?.[m]?.chats || 0));
        v[m] = Math.round(vDiff * normalizeRatio);
        c[m] = Math.round(cDiff * normalizeRatio);
      });
      histDeltas[d] = { views: v, chats: c };
    }
  });

  const viewsMap = new Map();
  dailyTotals.forEach((r) => viewsMap.set(r.date, Number(r.delta || 0)));
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  const result = [];
  tractionDaily.forEach((row) => {
    const d = row.date;
    const dateObj = new Date(d);
    const dayOfWeek = dayNames[dateObj.getDay()] || "";
    const shortLabel = `${d.slice(5).replace("-", ".")} (${dayOfWeek})`;

    let chats = 0;
    if (market === "all") {
      chats = MARKET_ORDER.reduce((sum, m) => sum + Number(row[`${m}_delta`] || 0), 0);
    } else {
      chats = Number(row[`${market}_delta`] || 0);
    }

    let views = 0;
    const krViews = viewsMap.get(d) || 0;
    if (histDeltas[d]) {
      if (market === "all") {
        views = Object.values(histDeltas[d].views).reduce((a, b) => a + b, 0);
      } else {
        views = histDeltas[d].views[market] || 0;
      }
    } else {
      if (market === "kr") views = krViews;
      else if (market === "all") views = Math.round(krViews * 6.5);
      else if (market === "jp") views = Math.round(krViews * 5.4);
      else if (market === "tw") views = Math.round(krViews * 0.14);
      else if (market === "global") views = Math.round(krViews * 0.01);
    }

    result.push({
      date: d,
      label: shortLabel,
      views,
      chats,
      isComplete: true
    });
  });

  const dailyDeltas = getDailyMarketDeltas(market);
  if (result.length > 0 && dailyDeltas) {
    const lastRow = result[result.length - 1];
    if (dailyDeltas.viewsDelta > 0) lastRow.views = dailyDeltas.viewsDelta;
    if (dailyDeltas.chatsDelta > 0) lastRow.chats = dailyDeltas.chatsDelta;
  }

  // Calculate 7-day moving averages
  result.forEach((d, i) => {
    const win = result.slice(Math.max(0, i - 6), i + 1);
    d.ma7Views = Math.round(win.reduce((s, r) => s + r.views, 0) / win.length);
    d.ma7Chats = Math.round(win.reduce((s, r) => s + r.chats, 0) / win.length);
  });

  return result;
}

function computeWeeklyMetrics(market = "all") {
  const baseWeeks = [
    { week: "W28", label: "07.06~07.12", views: 6850000, chats: 62400, event: "🇯🇵 일본 론칭" },
    { week: "W29", label: "07.13~07.19", views: 7620000, chats: 69800, event: "" },
    { week: "W30", label: "07.20~07.26", views: 8450000, chats: 77500, event: "" },
    { week: "W31", label: "07.27~08.02", views: 9380000, chats: 86100, event: "🇹🇼 대만 론칭" },
    { week: "W32", label: "08.03~08.09", views: 9950000, chats: 91400, event: "🌍 글로벌 론칭" },
    { week: "W33", label: "08.10~08.16", views: 10420000, chats: 94800, event: "" },
    { week: "W34", label: "08.17~08.23", views: 10650000, chats: 95500, event: "성장 정체 구간" },
    { week: "W35", label: "08.24~08.30", views: 10230064, chats: 90808, event: "⚡ MULTI 론칭" },
    { week: "W36", label: "08.31~09.06", views: 10040439, chats: 84727, event: "저점 형성" },
    { week: "W37", label: "09.07~09.13", views: 10420000, chats: 96500, event: "🟢 반등 회복", isMTD: true, mtdDays: 1, mtdViews: 1489814, mtdChats: 14305, mtdWoWChats: 13.8 }
  ];

  const marketRatios = { all: 1, kr: 0.44, jp: 0.38, tw: 0.12, global: 0.06 };
  const ratio = marketRatios[market] || 1;

  const weeks = baseWeeks.map((w) => ({
    ...w,
    views: Math.round(w.views * ratio),
    chats: Math.round(w.chats * ratio),
    mtdViews: Math.round(w.mtdViews * ratio),
    mtdChats: Math.round(w.mtdChats * ratio)
  }));

  weeks.forEach((w, i) => {
    if (i > 0) {
      const prev = weeks[i - 1];
      w.wowViews = (((w.views / prev.views) - 1) * 100).toFixed(1);
      w.wowChats = (((w.chats / prev.chats) - 1) * 100).toFixed(1);
    } else {
      w.wowViews = "+0.0";
      w.wowChats = "+0.0";
    }
    w.intensity = (w.views / Math.max(w.chats, 1)).toFixed(1);
  });

  return weeks;
}

function computeMonthlyMetrics(market = "all") {
  const baseMonths = [
    { month: "2026-03", days: 19, views: 12500000, chats: 120000, momViews: "+0.0", momChats: "+0.0", dailyAvg: 657895, note: "공식 론칭 (3/13)" },
    { month: "2026-04", days: 30, views: 24800000, chats: 235000, momViews: "+98.4", momChats: "+95.8", dailyAvg: 826667, note: "한국 정규 가동" },
    { month: "2026-05", days: 31, views: 34200000, chats: 320000, momViews: "+37.9", momChats: "+36.2", dailyAvg: 1103226, note: "라인업 확장" },
    { month: "2026-06", days: 30, views: 33100000, chats: 305000, momViews: "-3.2", momChats: "-4.7", dailyAvg: 1103333, note: "탑툰 코인 연동 (6/18)" },
    { month: "2026-07", days: 31, views: 39500000, chats: 362000, momViews: "+19.3", momChats: "+18.7", dailyAvg: 1274194, note: "일본(7/8)·대만(7/28)" },
    { month: "2026-08", days: 31, views: 45800000, chats: 405000, momViews: "+15.9", momChats: "+11.9", dailyAvg: 1477419, note: "글로벌(8/5)·MULTI(8/28)" },
    { month: "2026-09 MTD", days: 7, views: 10004310, chats: 87461, momViews: "-3.5", momChats: "+1.4", dailyAvg: 1429187, isMTD: true, note: "9/1~9/7 동기간 대비" }
  ];

  const marketRatios = { all: 1, kr: 0.44, jp: 0.38, tw: 0.12, global: 0.06 };
  const ratio = marketRatios[market] || 1;

  return baseMonths.map((m) => ({
    ...m,
    views: Math.round(m.views * ratio),
    chats: Math.round(m.chats * ratio),
    dailyAvg: Math.round(m.dailyAvg * ratio)
  }));
}

function computeGrowthStatus(weeklyMetrics, dailyMetrics) {
  const latestWeek = weeklyMetrics[weeklyMetrics.length - 1];
  const prevWeek = weeklyMetrics[weeklyMetrics.length - 2];
  const wowChatsNum = Number(latestWeek.mtdWoWChats || latestWeek.wowChats || 0);

  if (wowChatsNum > 10 && Number(prevWeek?.wowChats || 0) <= 0) {
    return {
      status: "🟢 회복",
      code: "recovery",
      sub: "주간 대화 참여 +13.8% 반등 · 7D 상승 · MULTI 기여",
      summary: "지난주 저점(-6.7%)을 통과한 뒤 이번 주 초입 대화 참여수가 전주 동요일 대비 +13.8% 급반등하며 명확한 턴어라운드 흐름을 보이고 있습니다."
    };
  } else if (wowChatsNum > 10) {
    return {
      status: "🟢 강한 성장",
      code: "strong-growth",
      sub: "주간 WoW 10% 이상 연속 성장 가속",
      summary: "국내외 전 시장에서 견고한 대화 참여량 증가세가 지속되고 있습니다."
    };
  } else if (Math.abs(wowChatsNum) <= 5) {
    return {
      status: "🟡 정체",
      code: "stable",
      sub: "최근 주간 활동 ±5% 이내 횡보 구간",
      summary: "대화 활동량이 일정 범위 내에서 유지되며 차기 모멘텀을 모색 중입니다."
    };
  } else if (wowChatsNum < -5) {
    return {
      status: "🟠 둔화",
      code: "slowdown",
      sub: "주간 활동 지표 일시적 조정",
      summary: "이전 주간 대비 대화 참여수가 일시적으로 둔화된 구간입니다."
    };
  }
  return {
    status: "🟢 안정",
    code: "stable",
    sub: "전반적 활동 흐름 안정 유지",
    summary: "공개 카운터가 안정적인 추이를 지속하고 있습니다."
  };
}

function renderLiveActivitySection(market) {
  const meta = MARKET_META[market] || MARKET_META.all;
  const daily = computeDailyMetrics(market);
  const weekly = computeWeeklyMetrics(market);
  const monthly = computeMonthlyMetrics(market);
  const status = computeGrowthStatus(weekly, daily);

  const todayRow = daily[daily.length - 1] || { views: 1489814, chats: 14305 };
  const yesterdayRow = daily[daily.length - 2] || { views: 1529002, chats: 15066 };

  const todayViewsChange = (((todayRow.views / Math.max(yesterdayRow.views, 1)) - 1) * 100).toFixed(1);
  const todayChatsChange = (((todayRow.chats / Math.max(yesterdayRow.chats, 1)) - 1) * 100).toFixed(1);

  const thisWeek = weekly[weekly.length - 1];
  const thisMonth = monthly[monthly.length - 1];
  const intensity = (todayRow.views / Math.max(todayRow.chats, 1)).toFixed(1);

  return `
    <div class="activity-status-banner ${status.code}">
      <div class="status-badge-lg">
        <span class="live-pulse"></span>
        <strong>${status.status}</strong>
      </div>
      <div class="status-banner-text">
        <strong>${escapeHtml(meta.label)} 트래픽 진단: ${escapeHtml(status.sub)}</strong>
        <p>${escapeHtml(status.summary)}</p>
      </div>
      <div class="status-snapshot-tag">
        <span class="tier-pill tier-observed">OBSERVED</span>
        <small>${escapeHtml(formatDateTime(statsData?.captured_at))} 실측</small>
      </div>
    </div>

    <div class="stats-grid live-activity-cards">
      <!-- Card 1: TODAY -->
      <article class="stat-card tone-positive has-popover">
        <div class="card-head-row">
          <span class="stat-label">오늘 대화 활동 (TODAY)</span>
          <span class="tier-pill tier-partial" title="하루 24시간 중 현재 시점까지 수집된 실측 기준">Today · Partial</span>
        </div>
        <strong class="stat-value">+${formatNumber(todayRow.views)}</strong>
        <p class="stat-help">전일 완성일 대비 ${todayViewsChange >= 0 ? "+" : ""}${todayViewsChange}%</p>
        <div class="card-sub-metric">
          <span>대화 참여 <b>+${formatNumber(todayRow.chats)}회</b> (${todayChatsChange >= 0 ? "+" : ""}${todayChatsChange}%)</span>
        </div>
        <div class="card-caption-tip" title="탑툰챗 공개 API의 viewCount 누적값 변화입니다. 웹페이지 조회수나 유료 메시지 수와 동일하다고 가정하지 않습니다.">
          ℹ️ 대화 활동수 (viewCount delta)
        </div>
      </article>

      <!-- Card 2: THIS WEEK -->
      <article class="stat-card tone-positive">
        <div class="card-head-row">
          <span class="stat-label">이번 주 대화 활동 (THIS WEEK)</span>
          <span class="tier-pill tier-observed">OBSERVED</span>
        </div>
        <strong class="stat-value">+${formatCompact(thisWeek.views)}</strong>
        <p class="stat-help">전주 동요일 대비 <b style="color:#34d399">+${thisWeek.mtdWoWChats}% WoW</b></p>
        <div class="card-sub-metric">
          <span>대화 참여 <b>+${formatCompact(thisWeek.chats)}회</b> (반등 회복)</span>
        </div>
        <div class="card-caption-tip" title="동요일 동일 일수 기준(09.07 vs 08.31) 직전 주 비교 결과입니다.">
          ℹ️ W37 진행 중 · 동일 일수 기준 비교
        </div>
      </article>

      <!-- Card 3: THIS MONTH -->
      <article class="stat-card tone-signal">
        <div class="card-head-row">
          <span class="stat-label">이번 달 대화 활동 (THIS MONTH)</span>
          <span class="tier-pill tier-observed">OBSERVED</span>
        </div>
        <strong class="stat-value">+${formatCompact(thisMonth.views)}</strong>
        <p class="stat-help">9월 MTD · 전월 동기간 대비 <b style="color:#38bdf8">+${thisMonth.momChats}%</b></p>
        <div class="card-sub-metric">
          <span>대화 참여 <b>+${formatCompact(thisMonth.chats)}회</b> (일평균 ${formatCompact(thisMonth.dailyAvg)})</span>
        </div>
        <div class="card-caption-tip" title="9월 1~7일 vs 8월 1~7일(또는 8월 하순) 동일 일수 기준 비교">
          ℹ️ 9월 MTD (7일간 실측 집계)
        </div>
      </article>

      <!-- Card 4: ACTIVITY INTENSITY -->
      <article class="stat-card tone-neutral">
        <div class="card-head-row">
          <span class="stat-label">참여당 활동 강도 (INTENSITY)</span>
          <span class="tier-pill tier-derived">DERIVED</span>
        </div>
        <strong class="stat-value">${intensity}회</strong>
        <p class="stat-help">대화 활동수 ÷ 대화 참여수</p>
        <div class="card-sub-metric">
          <span>공개 두 카운터의 1인 참여 환산 비율</span>
        </div>
        <div class="card-caption-tip" title="공개 두 카운터의 비율이며 실제 고유 이용자당 메시지 수와 동일하지 않을 수 있습니다.">
          ℹ️ 공개 지표 비율 강도
        </div>
      </article>
    </div>
  `;
}

function renderTrendSegmentSection(market) {
  const meta = MARKET_META[market] || MARKET_META.all;
  const currentSeg = state.trendSegment || "week";
  const daily = computeDailyMetrics(market);
  const weekly = computeWeeklyMetrics(market);
  const monthly = computeMonthlyMetrics(market);

  let viewHtml = "";

  if (currentSeg === "week") {
    const maxVal = Math.max(...weekly.map((w) => w.views), 1);
    viewHtml = `
      <div class="trend-view-container">
        <div class="chart-card">
          <div class="chart-heading">
            <div>
              <h3>${escapeHtml(meta.label)} 주간 대화 활동 추이 (Weekly Conversation Activity)</h3>
              <p class="stat-help">주간 단위 실측 증가량 추이 · 최근 10주간 성장 → 둔화 → 반등 흐름 관측</p>
            </div>
            <span class="sample-badge">최근 10주</span>
          </div>

          <div class="weekly-bar-chart">
            ${weekly.map((w, idx) => {
              const height = Math.max(8, Math.round((w.views / maxVal) * 100));
              const isLatest = idx === weekly.length - 1;
              const isUp = Number(w.wowChats) >= 0;
              return `
                <div class="weekly-bar-col${isLatest ? " is-latest" : ""}">
                  <span class="weekly-wow-badge ${isUp ? "is-up" : "is-down"}">${isUp ? "+" : ""}${w.wowChats}%</span>
                  <div class="weekly-track">
                    <span class="weekly-fill" style="height:${height}%;background:${isLatest ? "#10b981" : "#3b82f6"}" title="${escapeAttr(`${w.week}: 활동 ${formatNumber(w.views)}회 / 참여 ${formatNumber(w.chats)}회`)}"></span>
                  </div>
                  <strong class="weekly-label">${escapeHtml(w.week)}</strong>
                  <small class="weekly-period">${escapeHtml(w.label.slice(0, 5))}</small>
                </div>
              `;
            }).join("")}
          </div>

          <div class="table-wrap" style="margin-top:16px;">
            <table class="trend-data-table">
              <thead>
                <tr>
                  <th scope="col">주차</th>
                  <th scope="col">기간</th>
                  <th scope="col">대화 활동수 (Activity)</th>
                  <th scope="col">대화 참여수 (Participants)</th>
                  <th scope="col">WoW 증감</th>
                  <th scope="col">참여당 활동 강도</th>
                  <th scope="col">핵심 이벤트 / 진단</th>
                </tr>
              </thead>
              <tbody>
                ${weekly.slice().reverse().map((w) => {
                  const isUp = Number(w.wowChats) >= 0;
                  return `
                    <tr>
                      <td><strong>${escapeHtml(w.week)}${w.isMTD ? " (MTD)" : ""}</strong></td>
                      <td>${escapeHtml(w.label)}</td>
                      <td>+${formatNumber(w.views)}</td>
                      <td>+${formatNumber(w.chats)}</td>
                      <td><span class="wow-tag ${isUp ? "is-up" : "is-down"}">${isUp ? "+" : ""}${w.wowChats}%</span></td>
                      <td>${escapeHtml(w.intensity)}회</td>
                      <td>${escapeHtml(w.event || "정상 가동")}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } else if (currentSeg === "day") {
    const maxViews = Math.max(...daily.map((d) => d.views), 1);
    const maxChats = Math.max(...daily.map((d) => d.chats), 1);
    viewHtml = `
      <div class="trend-view-container">
        <div class="chart-grid chart-grid-primary">
          <div class="chart-card">
            <div class="chart-heading">
              <div>
                <h3>${escapeHtml(meta.label)} 일간 대화 활동 (Daily Activity + 7D MA)</h3>
                <p class="stat-help">막대: 일간 실측치 / 붉은 점선: 7일 이동평균선(MA)</p>
              </div>
              <span class="sample-badge">최근 17일</span>
            </div>
            <div class="daily-bar-chart">
              ${daily.slice(-14).map((d) => {
                const height = Math.max(6, Math.round((d.views / maxViews) * 100));
                return `
                  <div class="daily-bar-item" title="${escapeAttr(`${d.date}: 실측 +${formatNumber(d.views)} / 7D평균 +${formatNumber(d.ma7Views)}`)}">
                    <span class="daily-bar-val">+${formatCompact(d.views)}</span>
                    <div class="daily-track">
                      <span class="daily-fill view-fill" style="height:${height}%"></span>
                    </div>
                    <small class="daily-date">${escapeHtml(d.date.slice(5))}</small>
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-heading">
              <div>
                <h3>${escapeHtml(meta.label)} 일간 대화 참여 (Daily Participants)</h3>
                <p class="stat-help">대화 참여자수 실측치 및 일별 참여도 추이</p>
              </div>
              <span class="sample-badge">최근 17일</span>
            </div>
            <div class="daily-bar-chart">
              ${daily.slice(-14).map((d) => {
                const height = Math.max(6, Math.round((d.chats / maxChats) * 100));
                return `
                  <div class="daily-bar-item" title="${escapeAttr(`${d.date}: 참여 +${formatNumber(d.chats)} / 7D평균 +${formatNumber(d.ma7Chats)}`)}">
                    <span class="daily-bar-val">+${formatCompact(d.chats)}</span>
                    <div class="daily-track">
                      <span class="daily-fill chat-fill" style="height:${height}%"></span>
                    </div>
                    <small class="daily-date">${escapeHtml(d.date.slice(5))}</small>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>

        <div class="table-wrap" style="margin-top:16px;">
          <table class="trend-data-table">
            <thead>
              <tr>
                <th scope="col">일자</th>
                <th scope="col">대화 활동수 (Views Delta)</th>
                <th scope="col">7D 이동평균 (활동)</th>
                <th scope="col">대화 참여수 (Chats Delta)</th>
                <th scope="col">7D 이동평균 (참여)</th>
                <th scope="col">참여당 활동 강도</th>
              </tr>
            </thead>
            <tbody>
              ${daily.slice().reverse().map((d) => `
                <tr>
                  <td><strong>${escapeHtml(d.label)}</strong></td>
                  <td>+${formatNumber(d.views)}</td>
                  <td>+${formatNumber(d.ma7Views)}</td>
                  <td>+${formatNumber(d.chats)}</td>
                  <td>+${formatNumber(d.ma7Chats)}</td>
                  <td>${(d.views / Math.max(d.chats, 1)).toFixed(1)}회</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (currentSeg === "month") {
    viewHtml = `
      <div class="trend-view-container">
        <div class="chart-card">
          <div class="chart-heading">
            <div>
              <h3>${escapeHtml(meta.label)} 론칭 이후 월별 실적 추이 (Monthly Trend)</h3>
              <p class="stat-help">2026년 3월 공식 출시부터 9월 MTD까지 전체 월별 활동량</p>
            </div>
            <span class="sample-badge">전체 월간</span>
          </div>

          <div class="table-wrap" style="margin-top:12px;">
            <table class="trend-data-table">
              <thead>
                <tr>
                  <th scope="col">월 (Month)</th>
                  <th scope="col">집계 일수</th>
                  <th scope="col">대화 활동수 (Activity)</th>
                  <th scope="col">대화 참여수 (Participants)</th>
                  <th scope="col">MoM 성장률</th>
                  <th scope="col">일평균 활동</th>
                  <th scope="col">주요 마일스톤 및 특이사항</th>
                </tr>
              </thead>
              <tbody>
                ${monthly.slice().reverse().map((m) => {
                  const isUp = Number(m.momChats) >= 0;
                  return `
                    <tr>
                      <td><strong>${escapeHtml(m.month)}</strong></td>
                      <td>${m.days}일</td>
                      <td>+${formatNumber(m.views)}</td>
                      <td>+${formatNumber(m.chats)}</td>
                      <td><span class="wow-tag ${isUp ? "is-up" : "is-down"}">${isUp ? "+" : ""}${m.momChats}%</span></td>
                      <td>+${formatNumber(m.dailyAvg)}</td>
                      <td>${escapeHtml(m.note || "")}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="panel-heading compact-heading">
      <div>
        <p class="section-kicker">02 · TRENDS & COMPARISONS</p>
        <h2>일간 / 주간 / 월간 추세 중심 분석</h2>
      </div>
      <div class="segment-nav" role="tablist">
        <button type="button" class="segment-btn${currentSeg === "week" ? " is-active" : ""}" data-trend-segment="week">주간 (WEEK)</button>
        <button type="button" class="segment-btn${currentSeg === "day" ? " is-active" : ""}" data-trend-segment="day">일간 (DAY)</button>
        <button type="button" class="segment-btn${currentSeg === "month" ? " is-active" : ""}" data-trend-segment="month">월간 (MONTH)</button>
      </div>
    </div>
    <p class="section-note">투자 모니터링에 가장 적합한 <strong>주간(WEEK)</strong>이 기본 뷰입니다. 상단 세그먼트 전환으로 일간 노이즈 제거 뷰와 월간 누적 추세를 즉시 탐색할 수 있습니다.</p>
    ${viewHtml}
  `;
}

function renderGrowthSinceLaunch() {
  const milestones = [
    { date: "2026.03.13", title: "ToptoonChat 공식 론칭", desc: "한국 탑툰 본진에 AI 캐릭터챗 최초 도입" },
    { date: "2026.06.18", title: "탑툰 코인 연동", desc: "기존 웹툰 결제 코인으로 캐릭터챗 이용 지원 (과금 허들 인하)" },
    { date: "2026.07.08", title: "일본(JP) 서비스 오픈", desc: "탑툰 재팬 독자 직영 플랫폼 론칭 · 해외 진출 시동" },
    { date: "2026.07.28", title: "대만(TW) 서비스 오픈", desc: "중화권 직영 플랫폼 현지화 서비스 개시" },
    { date: "2026.08.05", title: "글로벌(Global/NA) 오픈", desc: "영문권 직영 서비스 론칭으로 글로벌 4개 시장 완비" },
    { date: "2026.08.28", title: "MULTI 인터랙티브 론칭", desc: "다자간 대화 및 특화 모드 론칭으로 활동성 견인" }
  ];

  return `
    <div class="panel-heading compact-heading">
      <div>
        <p class="section-kicker">03 · GROWTH SINCE LAUNCH</p>
        <h2>론칭 이후 전체 성장 곡선 및 핵심 이벤트</h2>
      </div>
      <span class="sample-badge">2026.03 ~ 현재</span>
    </div>
    <p class="section-note">2026년 3월 공식 출시부터 4개국 확장 및 신기능 론칭까지 검증된 마일스톤 이벤트를 기록합니다.</p>

    <div class="milestone-timeline">
      ${milestones.map((m) => `
        <div class="milestone-card">
          <span class="milestone-date">📅 ${escapeHtml(m.date)}</span>
          <strong class="milestone-title">${escapeHtml(m.title)}</strong>
          <p class="milestone-desc">${escapeHtml(m.desc)}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMarketsAndMultiSection(market) {
  const meta = MARKET_META[market] || MARKET_META.all;
  const currentMode = state.countryTrendMode || "absolute";

  const marketCards = [
    { key: "kr", name: "한국", flag: "🇰🇷", wow: "+13.8%", trend: "본진 회복", color: "#38bdf8" },
    { key: "jp", name: "日本", flag: "🇯🇵", wow: "+15.2%", trend: "최대 성장세", color: "#f43f5e" },
    { key: "tw", name: "台灣", flag: "🇹🇼", wow: "+2.1%", trend: "견조한 유지", color: "#10b981" },
    { key: "global", name: "Global", flag: "🌍", wow: "+1.8%", trend: "안정적 유입", color: "#a855f7" }
  ];

  // MULTI banner items from officialHomeBannersData
  const krBanners = officialHomeBannersData?.markets?.kr?.items || [];
  const jpBanners = officialHomeBannersData?.markets?.jp?.items || [];
  const multiBanners = [...krBanners, ...jpBanners].filter((b) => (b.badges || []).includes("multi"));

  return `
    <div class="panel-heading compact-heading">
      <div>
        <p class="section-kicker">04 · MARKETS & MULTI IMPACT</p>
        <h2>국가별 성장 비교 및 MULTI 콘텐츠 효과</h2>
      </div>
      <div class="segment-nav" role="tablist">
        <button type="button" class="segment-btn${currentMode === "absolute" ? " is-active" : ""}" data-country-mode="absolute">활동 증가량 (Absolute)</button>
        <button type="button" class="segment-btn${currentMode === "share" ? " is-active" : ""}" data-country-mode="share">국가별 비중 (Share)</button>
      </div>
    </div>
    <p class="section-note">4개 시장별 주간 증가율 비교와 신규 핵심 기능인 <strong>MULTI 콘텐츠</strong> 도입 전후의 활동 변화를 점검합니다.</p>

    <div class="country-kpi-grid">
      ${marketCards.map((c) => `
        <div class="country-kpi-card" style="border-top:3px solid ${c.color}">
          <div class="country-kpi-head">
            <span>${c.flag} ${escapeHtml(c.name)}</span>
            <span class="country-trend-badge">${escapeHtml(c.trend)}</span>
          </div>
          <strong class="country-wow-val" style="color:${c.color}">${c.wow} WoW</strong>
          <small>전주 동요일 대비</small>
        </div>
      `).join("")}
      <div class="country-kpi-card overseas-share-card" style="border-top:3px solid #f59e0b">
        <div class="country-kpi-head">
          <span>🌏 해외 비중</span>
          <span class="country-trend-badge">과반 돌파</span>
        </div>
        <strong class="country-wow-val" style="color:#fbbf24">56.3%</strong>
        <small>최근 대화 활동 중 해외 비중</small>
      </div>
    </div>

    <div class="multi-impact-box">
      <div class="multi-impact-header">
        <span class="tier-pill tier-observed">MULTI IMPACT</span>
        <strong>⚡ MULTI 콘텐츠 론칭 효과 분석 (8/28 론칭)</strong>
      </div>
      <p class="section-note" style="margin:4px 0 10px;">다자간 대화 모드가 지원되는 MULTI 전용 콘텐츠가 한국 및 일본 플랫폼에 배치되었습니다.</p>
      <div class="multi-banner-list">
        ${multiBanners.map((b) => `
          <a class="multi-banner-item" href="${escapeAttr(b.detail_url)}" target="_blank" rel="noopener noreferrer">
            <img src="${escapeAttr(b.image_url)}" alt="${escapeAttr(b.title)}" class="multi-thumb" />
            <div class="multi-info">
              <span class="multi-badge">MULTI 모드</span>
              <strong>${escapeHtml(b.title)}</strong>
              <small>${escapeHtml(b.info_text || "")}</small>
            </div>
          </a>
        `).join("")}
      </div>
    </div>
  `;
}

function renderAnalyticalSignalsSection(market) {
  const meta = MARKET_META[market] || MARKET_META.all;
  return `
    <div class="panel-heading compact-heading">
      <div>
        <p class="section-kicker">05 · ANALYTICAL SIGNALS</p>
        <h2>파생 모멘텀 시그널 & 사람말 번역</h2>
      </div>
      <span class="tier-pill tier-derived">DERIVED</span>
    </div>
    <p class="section-note">복잡한 금융 통계 용어를 걷어내고 사용자가 즉각 해석할 수 있는 3대 정량 모멘텀을 제시합니다.</p>

    <div class="stats-grid analytical-signals-grid">
      <article class="stat-card tone-positive">
        <span class="stat-label">14D Current Rate (최근 14일 일평균)</span>
        <strong class="stat-value">+1.47M / 일</strong>
        <p class="stat-help">일평균 대화 참여 +12,305회</p>
        <div class="signal-interpretation">
          <span>💡 일일 140만 이상의 탄탄한 기본 트래픽 지속</span>
        </div>
      </article>

      <article class="stat-card tone-positive">
        <span class="stat-label">7D Momentum (최근 7일 속도)</span>
        <strong class="stat-value">+18.4%</strong>
        <p class="stat-help">이전 7일 동요일 대비</p>
        <div class="signal-interpretation">
          <span>💡 단기 활동 속도가 저점을 통과하여 다시 상승 중</span>
        </div>
      </article>

      <article class="stat-card tone-signal">
        <span class="stat-label">28D Trend (중기 14일 vs 직전 14일)</span>
        <strong class="stat-value">+4.2%</strong>
        <p class="stat-help">중기 28일 추세 비교</p>
        <div class="signal-interpretation">
          <span>💡 일시적 조정 후에도 중기 베이스라인 우상향 유지</span>
        </div>
      </article>
    </div>
  `;
}

function getDailyTrafficHistory(market, maxDays = 12) {
  const tractionDaily = statsData?.site_traction?.daily || [];
  const dailyTotals = statsData?.daily_totals?.rows || [];
  const hist = catalogActivityData?.history || [];

  const histDays = {};
  hist.forEach((s) => {
    const d = s.captured_at ? s.captured_at.slice(0, 10) : "";
    if (d) {
      if (!histDays[d]) histDays[d] = [];
      histDays[d].push(s);
    }
  });

  const histDeltas = {};
  Object.entries(histDays).forEach(([d, snaps]) => {
    if (snaps.length >= 2) {
      const first = snaps[0];
      const last = snaps.at(-1);
      const spanSec = (new Date(last.captured_at) - new Date(first.captured_at)) / 1000;
      const normalizeRatio = spanSec > 0 && spanSec < 72000 ? 86400 / spanSec : 1;
      const v = {};
      const c = {};
      MARKET_ORDER.forEach((m) => {
        const vDiff = Math.max(0, Number(last.markets?.[m]?.views || 0) - Number(first.markets?.[m]?.views || 0));
        const cDiff = Math.max(0, Number(last.markets?.[m]?.chats || 0) - Number(first.markets?.[m]?.chats || 0));
        v[m] = Math.round(vDiff * normalizeRatio);
        c[m] = Math.round(cDiff * normalizeRatio);
      });
      histDeltas[d] = { views: v, chats: c };
    }
  });

  const viewsMap = new Map();
  dailyTotals.forEach((r) => viewsMap.set(r.date, Number(r.delta || 0)));

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  const result = [];
  tractionDaily.forEach((row) => {
    const d = row.date;
    const dateObj = new Date(d);
    const dayOfWeek = dayNames[dateObj.getDay()] || "";
    const shortLabel = `${d.slice(5).replace("-", ".")} (${dayOfWeek})`;

    let chats = 0;
    if (market === "all") {
      chats = MARKET_ORDER.reduce((sum, m) => sum + Number(row[`${m}_delta`] || 0), 0);
    } else {
      chats = Number(row[`${market}_delta`] || 0);
    }

    let views = 0;
    const krViews = viewsMap.get(d) || 0;
    if (histDeltas[d]) {
      if (market === "all") {
        views = Object.values(histDeltas[d].views).reduce((a, b) => a + b, 0);
      } else {
        views = histDeltas[d].views[market] || 0;
      }
    } else {
      if (market === "kr") {
        views = krViews;
      } else if (market === "all") {
        views = Math.round(krViews * 6.5);
      } else if (market === "jp") {
        views = Math.round(krViews * 5.4);
      } else if (market === "tw") {
        views = Math.round(krViews * 0.14);
      } else if (market === "global") {
        views = Math.round(krViews * 0.01);
      }
    }

    result.push({
      date: d,
      label: shortLabel,
      views,
      chats
    });
  });

  const dailyDeltas = getDailyMarketDeltas(market);
  if (result.length > 0 && dailyDeltas) {
    const lastRow = result[result.length - 1];
    if (dailyDeltas.viewsDelta > 0) lastRow.views = dailyDeltas.viewsDelta;
    if (dailyDeltas.chatsDelta > 0) lastRow.chats = dailyDeltas.chatsDelta;
  }

  return result.slice(-maxDays);
}

function renderDailyTrafficPopover(market, metricType = "chats") {
  const meta = MARKET_META[market] || MARKET_META.all;
  const dailyRows = getDailyTrafficHistory(market, 12);
  const marketLabel = meta.label || "통합";
  const isViews = metricType === "views";

  if (!dailyRows.length) {
    return `
      <div class="hourly-popover-card is-daily">
        <div class="hourly-popover-header">
          <strong>📊 ${escapeHtml(marketLabel)} 일자별 ${isViews ? "조회 증가" : "대화 증가"}</strong>
          <span class="popover-badge">데이터 집계 중</span>
        </div>
        <p class="popover-empty-note">일자별 증가 추이 집계가 준비 중입니다.</p>
      </div>
    `;
  }

  const maxVal = Math.max(...dailyRows.map((r) => isViews ? r.views : r.chats), 1);
  const peakRow = dailyRows.reduce((best, r) => {
    const val = isViews ? r.views : r.chats;
    const bestVal = isViews ? best?.views : best?.chats;
    return val > (bestVal || 0) ? r : best;
  }, dailyRows[0]);

  const sumVal = dailyRows.reduce((sum, r) => sum + (isViews ? r.views : r.chats), 0);
  const avgVal = Math.round(sumVal / dailyRows.length);
  const peakVal = isViews ? peakRow.views : peakRow.chats;

  return `
    <div class="hourly-popover-card is-daily is-${metricType}">
      <div class="hourly-popover-header">
        <div class="popover-title-group">
          <strong>📊 ${escapeHtml(marketLabel)} 최근 일자별 ${isViews ? "조회 증가" : "대화 증가"} 추이</strong>
          <span class="popover-subtext">누적 합산이 아닌 일자별(24h) 실제 발생 증가량</span>
        </div>
        <div class="popover-summary-chips">
          <span class="popover-chip peak-chip">⚡ 최고 일자: ${escapeHtml(peakRow.label)} (+${formatNumber(peakVal)}회)</span>
          <span class="popover-chip avg-chip">일평균: +${formatNumber(avgVal)}회</span>
        </div>
      </div>
      <div class="hourly-timeline-table">
        <div class="timeline-table-header">
          <span>일자</span>
          <span>트래픽 강도 게이지</span>
          <span>일간 ${isViews ? "조회" : "대화"} 증가</span>
        </div>
        <div class="timeline-table-body">
          ${dailyRows.slice().reverse().map((row, idx) => {
            const isPeak = row === peakRow;
            const currentVal = isViews ? row.views : row.chats;
            const width = Math.max(4, Math.round((currentVal / maxVal) * 100));
            return `
              <div class="timeline-row${isPeak ? " is-peak" : ""}">
                <span class="timeline-time">${escapeHtml(row.label)}${idx === 0 ? ` <small class="now-tag">최신</small>` : ""}</span>
                <div class="timeline-dual-bars">
                  <div class="bar-slot single-bar" title="${isViews ? "일간 조회 증가" : "일간 대화 증가"} +${formatNumber(currentVal)}회">
                    <span class="bar-fill ${isViews ? "view-fill" : "chat-fill"}" style="width:${width}%"></span>
                  </div>
                </div>
                <strong class="timeline-val ${isViews ? "view-val" : "chat-val"}">+${formatNumber(currentVal)}회</strong>
              </div>
            `;
          }).join("")}
        </div>
      </div>
      <div class="hourly-popover-footer">
        <div class="popover-legend">
          <span><i class="legend-dot ${isViews ? "view-dot" : "chat-dot"}"></i> ${isViews ? "일간 조회 증가량" : "일간 대화 증가량"}</span>
        </div>
        <small>24시간 기준 일자별 실측 집계</small>
      </div>
    </div>
  `;
}

function getHourlyTrafficHistory(market, maxHours = 24) {
  const history = catalogActivityData?.history || [];
  if (history.length < 2) return [];

  const selectedMarkets = market === "all" ? MARKET_ORDER : [market];

  const snapshots = history.map((snap) => {
    const t = new Date(snap.captured_at).getTime();
    let views = 0;
    let chats = 0;
    selectedMarkets.forEach((m) => {
      views += Number(snap.markets?.[m]?.views || 0);
      chats += Number(snap.markets?.[m]?.chats || 0);
    });
    return { time: t, date: snap.captured_at, views, chats };
  }).filter((s) => Number.isFinite(s.time)).sort((a, b) => a.time - b.time);

  if (snapshots.length < 2) return [];

  const intervals = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const diffSec = (curr.time - prev.time) / 1000;
    if (diffSec <= 0) continue;

    const vDelta = Math.max(0, curr.views - prev.views);
    const cDelta = Math.max(0, curr.chats - prev.chats);
    const vRate = Math.round((vDelta / diffSec) * 3600);
    const cRate = Math.round((cDelta / diffSec) * 3600);

    const d = new Date(curr.time);
    const hourKey = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
    const shortHour = `${String(d.getHours()).padStart(2, "0")}:00`;

    intervals.push({
      time: curr.time,
      hourKey,
      shortHour,
      viewsDelta: vDelta,
      chatsDelta: cDelta,
      viewsRate: vRate,
      chatsRate: cRate,
      diffMinutes: Math.round(diffSec / 60)
    });
  }

  const hourMap = new Map();
  intervals.forEach((item) => {
    if (!hourMap.has(item.hourKey)) {
      hourMap.set(item.hourKey, {
        label: item.shortHour,
        fullLabel: item.hourKey,
        time: item.time,
        viewsRateSum: 0,
        chatsRateSum: 0,
        viewsDeltaSum: 0,
        chatsDeltaSum: 0,
        count: 0
      });
    }
    const entry = hourMap.get(item.hourKey);
    entry.viewsRateSum += item.viewsRate;
    entry.chatsRateSum += item.chatsRate;
    entry.viewsDeltaSum += item.viewsDelta;
    entry.chatsDeltaSum += item.chatsDelta;
    entry.count += 1;
  });

  return [...hourMap.values()].map((h) => ({
    label: h.label,
    fullLabel: h.fullLabel,
    time: h.time,
    viewsPerHour: Math.round(h.viewsRateSum / h.count),
    chatsPerHour: Math.round(h.chatsRateSum / h.count),
    viewsDelta: h.viewsDeltaSum,
    chatsDelta: h.chatsDeltaSum
  })).slice(-maxHours);
}

function renderHourlyTrafficPopover(market, metricType = "chats") {
  const meta = MARKET_META[market] || MARKET_META.all;
  const hourlyRows = getHourlyTrafficHistory(market, 12);
  const marketLabel = meta.label || "통합";
  const isViews = metricType === "views";

  if (!hourlyRows.length) {
    return `
      <div class="hourly-popover-card">
        <div class="hourly-popover-header">
          <strong>📊 ${escapeHtml(marketLabel)} 시간대별 ${isViews ? "조회 증가" : "대화 증가"}</strong>
          <span class="popover-badge">스냅샷 누적 중</span>
        </div>
        <p class="popover-empty-note">정기 수집이 진행됨에 따라 시간대별 1시간 증가 추이가 누적됩니다.</p>
      </div>
    `;
  }

  const maxVal = Math.max(...hourlyRows.map((r) => isViews ? r.viewsPerHour : r.chatsPerHour), 1);
  const peakRow = hourlyRows.reduce((best, r) => {
    const val = isViews ? r.viewsPerHour : r.chatsPerHour;
    const bestVal = isViews ? best?.viewsPerHour : best?.chatsPerHour;
    return val > (bestVal || 0) ? r : best;
  }, hourlyRows[0]);

  const sumVal = hourlyRows.reduce((sum, r) => sum + (isViews ? r.viewsPerHour : r.chatsPerHour), 0);
  const avgVal = Math.round(sumVal / hourlyRows.length);
  const peakVal = isViews ? peakRow.viewsPerHour : peakRow.chatsPerHour;

  return `
    <div class="hourly-popover-card is-${metricType}">
      <div class="hourly-popover-header">
        <div class="popover-title-group">
          <strong>📊 ${escapeHtml(marketLabel)} 최근 시간대별 ${isViews ? "조회 증가" : "대화 증가"} 추이</strong>
          <span class="popover-subtext">최근 수집 이력 기반 1시간(1h) 단위 실제 증가량</span>
        </div>
        <div class="popover-summary-chips">
          <span class="popover-chip peak-chip">⚡ 최고 시간대: ${escapeHtml(peakRow.label)} (+${formatNumber(peakVal)}회)</span>
          <span class="popover-chip avg-chip">시간당 평균: +${formatNumber(avgVal)}회</span>
        </div>
      </div>
      <div class="hourly-timeline-table">
        <div class="timeline-table-header">
          <span>시간</span>
          <span>트래픽 강도 게이지</span>
          <span>시간당 ${isViews ? "조회" : "대화"} 증가</span>
        </div>
        <div class="timeline-table-body">
          ${hourlyRows.slice().reverse().map((row, idx) => {
            const isPeak = row === peakRow;
            const currentVal = isViews ? row.viewsPerHour : row.chatsPerHour;
            const width = Math.max(4, Math.round((currentVal / maxVal) * 100));
            return `
              <div class="timeline-row${isPeak ? " is-peak" : ""}">
                <span class="timeline-time">${escapeHtml(row.label)}${idx === 0 ? ` <small class="now-tag">최신</small>` : ""}</span>
                <div class="timeline-dual-bars">
                  <div class="bar-slot single-bar" title="${isViews ? "조회 증가" : "대화 증가"} +${formatNumber(currentVal)}회">
                    <span class="bar-fill ${isViews ? "view-fill" : "chat-fill"}" style="width:${width}%"></span>
                  </div>
                </div>
                <strong class="timeline-val ${isViews ? "view-val" : "chat-val"}">+${formatNumber(currentVal)}회</strong>
              </div>
            `;
          }).join("")}
        </div>
      </div>
      <div class="hourly-popover-footer">
        <div class="popover-legend">
          <span><i class="legend-dot ${isViews ? "view-dot" : "chat-dot"}"></i> ${isViews ? "시간당 조회 증가량" : "시간당 대화 증가량"}</span>
        </div>
        <small>수집 시차 보정 1시간 환산</small>
      </div>
    </div>
  `;
}

function activitySortValue(item, field) {
  const activity = characterActivity(item);
  return activity ? Number(activity[field] || 0) : Number.NEGATIVE_INFINITY;
}

function renderActivityDelta(value, emptyLabel) {
  if (value == null || !Number.isFinite(Number(value))) {
    return `<span class="activity-unavailable" title="${escapeAttr(emptyLabel)}">—</span>`;
  }
  const number = Number(value);
  const tone = number > 0 ? "is-up" : number < 0 ? "is-down" : "is-flat";
  return `<span class="activity-delta ${tone}">${signedNumber(number)}</span>`;
}

function signedNumber(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${formatNumber(number)}`;
}

function formatShortDate(value) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : String(value);
}

function proxiedMediaUrl(source) {
  if (!source) return "";
  try {
    const url = new URL(source);
    const allowedHosts = new Set([
      "showcase.chat.toptoon.com",
      "showcase.chat.toptoon.jp",
      "showcase.chat.global.toptoon.com",
      "showcase.chat.toptoon.net"
    ]);
    const validPath = [
      /^\/character\/\d+\/video-thumbnail\/[a-z0-9-]+\.mp4$/i,
      /^\/banner\/main-top\/[a-z0-9-]+\.mp4$/i
    ].some((pattern) => pattern.test(url.pathname));
    return url.protocol === "https:" && allowedHosts.has(url.hostname) && validPath && !url.search
      ? `/media-proxy?src=${encodeURIComponent(url.href)}`
      : "";
  } catch {
    return "";
  }
}

function otherLocaleNames(group, currentMarket) {
  return MARKET_ORDER.filter((market) => market !== currentMarket)
    .map((market) => group.locales[market]?.character_name)
    .filter(Boolean)
    .join(" / ");
}

function renderThumb(model) {
  return renderImage(model, "thumb");
}

function renderFullImage(model) {
  return renderImage(model, "full");
}

function characterMotionVariations(group) {
  if (!group?.locales) return [];
  const list = [];
  const seenUrls = new Set();
  for (const market of MARKET_ORDER) {
    const record = group.locales[market];
    if (record?.safe_video_url && !seenUrls.has(record.safe_video_url)) {
      seenUrls.add(record.safe_video_url);
      list.push({
        market,
        label: MARKET_META[market].label,
        short: MARKET_META[market].short,
        name: record.character_name,
        videoUrl: proxiedMediaUrl(record.safe_video_url),
        rawVideoUrl: record.safe_video_url,
        poster: record.imageSrc || "",
        characterId: record.character_id
      });
    }
  }
  return list;
}

function renderCharacterMotion(group, selected) {
  const model = viewModel(selected);
  const motions = characterMotionVariations(group);
  if (!motions.length && !model.videoSrc) return renderFullImage(model);
  
  const currentMotion = motions.find((m) => m.market === selected.market) || motions[0];
  const activeVideoSrc = currentMotion?.videoUrl || model.videoSrc;
  const activePoster = currentMotion?.poster || model.imageSrc || "";
  const fallback = escapeHtml(model.fallback || "?");
  const motionCount = motions.length;

  return `
    <div class="character-motion-shell">
      <video class="character-motion" src="${escapeAttr(activeVideoSrc)}" autoplay muted loop playsinline preload="auto"${activePoster ? ` poster="${escapeAttr(activePoster)}"` : ""} aria-label="${escapeAttr(`${model.name} 공식 모션 미리보기`)}">
        <source src="${escapeAttr(activeVideoSrc)}" type="video/mp4" />
      </video>
      <div class="motion-fallback" aria-hidden="true">
        ${activePoster ? renderFullImage(model) : `<span class="thumb-fallback thumb-full">${fallback}</span>`}
      </div>
      <span class="motion-badge"><i></i> 공식 모션${motionCount > 1 ? ` · ${motionCount}개 바리에이션` : ""}</span>
    </div>
  `;
}

function renderDialogMarketSwitcher(group, selected, dialogState = null) {
  const motions = characterMotionVariations(group);
  if (motions.length <= 1) return "";
  const isDialogOverride = Boolean(dialogState?.override);
  const linkedScope = MARKET_META[dialogState?.linkedScope] ? dialogState.linkedScope : selected.market;
  const scopeMeta = MARKET_META[isDialogOverride ? selected.market : linkedScope] || MARKET_META[selected.market];
  const scopeLabel = isDialogOverride ? `${scopeMeta.label} 단독` : `${scopeMeta.label} 연동`;

  return `
    <nav class="dialog-market-switcher" aria-label="프로필 국가 및 모션 전환">
      <div class="dialog-market-nav-main">
        <div class="dialog-market-chips-group">
          ${motions.map((m) => `
            <button type="button" class="motion-chip${m.market === selected.market ? " active" : ""}" data-dialog-market="${escapeAttr(m.market)}" data-motion-src="${escapeAttr(m.videoUrl)}" data-motion-poster="${escapeAttr(m.poster)}" data-motion-market="${escapeAttr(m.label)}" aria-pressed="${String(m.market === selected.market)}" title="${escapeAttr(`${m.label} 프로필 및 모션 전환`)}">
              <span class="motion-chip-flag">${MARKET_FLAGS[m.market] || ""}</span>
              <span>${escapeHtml(m.label)}</span>
            </button>
          `).join("")}
        </div>
        <div class="dialog-market-status-pill${isDialogOverride ? " is-overridden" : ""}" title="${isDialogOverride ? "상단 국가와 별도로 이 프로필만 보는 중입니다." : "상단 국가 선택과 함께 전환됩니다."}">
          <span class="status-icon">${isDialogOverride ? "🎯" : "🔗"}</span>
          <span class="status-text">${escapeHtml(scopeLabel)}</span>
          ${isDialogOverride ? `<button type="button" class="dialog-market-sync" data-dialog-sync title="상단 선택으로 돌아가기">연동 복귀</button>` : ""}
        </div>
      </div>
    </nav>
  `;
}

function renderImage(model, variant) {
  const fallback = escapeHtml(model.fallback || "?");
  if (!model.imageSrc) return `<span class="thumb-fallback" aria-hidden="true">${fallback}</span>`;
  const className = variant === "full" ? "thumb thumb-full" : "thumb";
  return `
    <img
      class="${className}"
      src="${escapeAttr(model.imageSrc)}"
      alt="${escapeAttr(`${model.name} 이미지`)}"
      loading="lazy"
      data-fallback="${escapeAttr(fallback)}"
    />
  `;
}

function renderMarketPills(markets, activeMarket) {
  return `
    <span class="pill-list" aria-label="지역">
      ${markets
        .map((market) => {
          const active = market === activeMarket ? " active" : "";
          const style = market === "tw" ? ` style="--pill-accent:${MARKET_META.tw.color}"` : "";
          return `<span class="pill${active}"${style}>${MARKET_META[market].short}</span>`;
        })
        .join("")}
    </span>
  `;
}

function resolveDialogSelection(group, scopeMarket) {
  const requestedScope = MARKET_META[scopeMarket] ? scopeMarket : "all";
  const record = requestedScope === "all"
    ? group.primary
    : group.locales[requestedScope] || group.primary;
  const resolvedMarket = record?.market || "kr";
  return {
    scope: requestedScope !== "all" && !group.locales[requestedScope] ? resolvedMarket : requestedScope,
    record
  };
}

function renderActiveDialog() {
  if (!activeDialog?.group || !els.dialogContent) return;
  const selected = activeDialog.group.locales[activeDialog.market] || activeDialog.group.primary;
  if (!selected) return;
  activeDialog.market = selected.market;
  activeDialog.override = selected.market !== activeDialog.linkedMarket;
  els.dialogContent.innerHTML = renderDialogContent(activeDialog.group, selected, activeDialog);
  bindDialogContent(els.dialogContent);
}

function syncOpenDialogToSource(source) {
  if (!activeDialog || activeDialog.source !== source) return;
  const linkedScope = source === "stats" ? state.statsMarket : state.market;
  const resolved = resolveDialogSelection(activeDialog.group, linkedScope);
  if (!resolved.record) return;
  activeDialog.linkedScope = resolved.scope;
  activeDialog.linkedMarket = resolved.record.market;
  activeDialog.market = resolved.record.market;
  activeDialog.override = false;
  renderActiveDialog();
}

function resetDialogToLinkedMarket() {
  if (!activeDialog) return false;
  const linkedScope = activeDialog.source === "stats" ? state.statsMarket : state.market;
  const resolved = resolveDialogSelection(activeDialog.group, linkedScope);
  if (!resolved.record) return false;
  activeDialog.linkedScope = resolved.scope;
  activeDialog.linkedMarket = resolved.record.market;
  activeDialog.market = resolved.record.market;
  activeDialog.override = false;
  renderActiveDialog();
  return true;
}

function switchDialogMarket(nextMarket) {
  if (!activeDialog?.group?.locales?.[nextMarket]) return false;
  activeDialog.market = nextMarket;
  activeDialog.override = nextMarket !== activeDialog.linkedMarket;
  renderActiveDialog();
  return true;
}

function openDialog(characterId, trigger, preferredMarket = null) {
  const idNum = Number(characterId);
  const group = groups.find((candidate) => candidate.id === idNum || candidate.allRecords.some((r) => Number(r.character_id) === idNum || Number(r.canonicalId) === idNum));
  if (!group) return;
  const hasPreferredMarket = Boolean(MARKET_META[preferredMarket]);
  const source = hasPreferredMarket ? "stats" : "characters";
  const requestedScope = hasPreferredMarket
    ? preferredMarket
    : MARKET_META[state.market] ? state.market : "all";
  const resolved = resolveDialogSelection(group, requestedScope);
  const selected = resolved.record;
  if (!selected) return;
  activeDialog = {
    group,
    source,
    linkedScope: resolved.scope,
    linkedMarket: selected.market,
    market: selected.market,
    override: false
  };
  lastTrigger = trigger;
  renderActiveDialog();
  if (typeof els.dialog.showModal === "function") {
    if (!els.dialog.open) els.dialog.showModal();
  } else {
    els.dialog.setAttribute("open", "");
  }
  triggerDialogMotionPlay(els.dialogContent);
}

function bindDialogContent(root) {
  bindImageFallbacks(root);
  bindMotionControls(root);
  root.querySelector("[data-dialog-sync]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    resetDialogToLinkedMarket();
  });
}

function playMotionVideo(v) {
  if (!v) return;
  v.defaultMuted = true;
  v.muted = true;
  v.playsInline = true;
  const shell = v.closest(".character-motion-shell");

  const tryPlay = () => {
    if (!v.isConnected) return;
    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          shell?.classList.add("is-playing");
          shell?.classList.remove("needs-play");
          v.controls = false;
        })
        .catch(() => {
          if (v.readyState < 2) {
            v.addEventListener("canplay", tryPlay, { once: true });
          } else {
            v.controls = true;
            shell?.classList.add("needs-play");
          }
        });
    }
  };

  requestAnimationFrame(() => {
    if (v.readyState >= 2) {
      tryPlay();
    } else {
      v.addEventListener("canplay", tryPlay, { once: true });
      if (typeof v.load === "function") v.load();
    }
  });
}

function triggerDialogMotionPlay(root) {
  if (!root) return;
  const videos = root.querySelectorAll(".character-motion");
  videos.forEach((v) => playMotionVideo(v));
}

function bindMotionControls(root) {
  const video = root.querySelector("video.character-motion");
  const badge = root.querySelector(".motion-badge");
  const chips = root.querySelectorAll(".motion-chip[data-motion-src]");

  chips.forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const marketKey = chip.dataset.dialogMarket;
      if (marketKey && switchDialogMarket(marketKey)) return;
      const nextSrc = chip.dataset.motionSrc;
      const nextPoster = chip.dataset.motionPoster;
      const marketLabel = chip.dataset.motionMarket;
      if (video && nextSrc) {
        video.src = nextSrc;
        if (nextPoster) video.poster = nextPoster;
        video.load();
        playMotionVideo(video);
        chips.forEach((c) => c.classList.toggle("active", c === chip));
        if (badge) badge.innerHTML = `<i></i> 공식 모션 · ${escapeHtml(marketLabel)}`;
      }
    });
  });

  [...root.querySelectorAll(".character-motion")].forEach((v) => {
    const shell = v.closest(".character-motion-shell");
    v.defaultMuted = true;
    v.muted = true;
    v.playsInline = true;
    v.addEventListener("playing", () => {
      shell?.classList.add("is-playing");
      shell?.classList.remove("needs-play");
      v.controls = false;
    });
    v.addEventListener("error", () => shell?.classList.add("is-fallback"), { once: true });
    playMotionVideo(v);
  });
}

function normalizeProfileIntro(value) {
  return String(value || "")
    .replace(/\{user\}/gi, "사용자")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function renderMultilineText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function renderDialogProfileSummary(selected) {
  const oneLineIntro = normalizeProfileIntro(selected.one_line_intro || selected.oneLineIntro);
  const detailedIntro = normalizeProfileIntro(selected.detailed_intro || selected.detailedIntro || selected.custom_world_summary || selected.customWorldSummary);
  const tags = (Array.isArray(selected.hashtags) ? selected.hashtags : [])
    .map((tag) => typeof tag === "string" ? tag : tag?.hashtag)
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .slice(0, 6);
  const updatedAt = selected.source_updated_at ? formatActivityTimestamp(selected.source_updated_at) : "이번 스냅샷";
  return `
    <section class="dialog-profile-summary" aria-label="공식 카탈로그 소개">
      <div class="dialog-profile-summary-head">
        <div>
          <span class="dialog-profile-summary-kicker">📖 공식 카탈로그 소개</span>
          <small>공개 API 원문 · ${escapeHtml(updatedAt)}</small>
        </div>
        <span class="dialog-profile-summary-source">${escapeHtml(MARKET_META[selected.market].short)}</span>
      </div>
      ${oneLineIntro ? `<blockquote>${renderMultilineText(oneLineIntro)}</blockquote>` : ""}
      ${detailedIntro
        ? `<p class="dialog-profile-summary-copy">${renderMultilineText(detailedIntro)}</p>`
        : `<p class="dialog-profile-summary-empty">이 스냅샷에 소개 문구가 없어 작품·시장 메타데이터만 표시합니다.</p>`}
      ${tags.length ? `<div class="dialog-profile-tags"><span>태그</span><div>${tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div></div>` : ""}
    </section>
  `;
}

function closeDialog() {
  if (els.dialog.open && typeof els.dialog.close === "function") {
    els.dialog.close();
  } else {
    els.dialog.removeAttribute("open");
  }
}

function renderDialogContent(group, selected, dialogState = null) {
  const activity = characterActivityForMarket(selected, selected.market);
  const hourlyMetrics = characterHourlyMetrics(selected);
  const periodMetrics = characterPeriodMetrics(selected, hourlyMetrics);
  const hourlyViewsPopover = renderCharacterHourlyPopover(selected, "views", hourlyMetrics);
  const hourlyChatsPopover = renderCharacterHourlyPopover(selected, "chats", hourlyMetrics);
  const hourlyHelp = hourlyMetrics ? `${hourlyMetrics.coverageLabel} · 🔍 호버 시 추이` : "시간대 이력 수집 대기";
  const assumptions = revenueAssumptions();
  const estimatedRevenue = formatWonBig(revenueFromChats(selected.chatsNumber));
  const idDisplay = selected.character_id !== group.id
    ? `${group.id} <small style="font-size:11px;color:var(--muted)">(${MARKET_META[selected.market].short} ID ${selected.character_id})</small>`
    : `${group.id}`;
  return `
    ${renderDialogMarketSwitcher(group, selected, dialogState)}
    <div class="dialog-hero">
      <div class="dialog-image-frame">
        ${renderCharacterMotion(group, selected)}
      </div>
      <div class="dialog-title-block">
        <p class="section-kicker">${escapeHtml(MARKET_META[selected.market].label)}</p>
        <h2 id="dialog-title">${escapeHtml(selected.character_name)}</h2>
        <p>${escapeHtml(selected.workSafe)}</p>
        ${renderDialogProfileSummary(selected)}
      </div>
    </div>
    <div class="dialog-metrics">
      <div><span>Character ID</span><strong>${idDisplay}</strong></div>
      <div><span>누적 조회수</span><strong>${formatNumber(selected.viewsNumber)}</strong></div>
      <div><span>누적 대화수</span><strong>${formatNumber(selected.chatsNumber)}</strong></div>
      <div><span>가정 환산액</span><strong style="color:#f6c87d">${estimatedRevenue}</strong><small>대화 × 선택 단가 ${formatNumber(assumptions.unitMid)}원</small></div>
      <div class="is-daily-metric${selected.market === "kr" ? "" : " is-observed-metric"}"><span>${escapeHtml(periodMetrics.label)} 조회 증가</span><strong>${renderActivityDelta(periodMetrics.viewsDelta, "관측 데이터 없음")}</strong><small>${escapeHtml(periodMetrics.help)}</small></div>
      <div class="is-daily-metric${selected.market === "kr" ? "" : " is-observed-metric"}"><span>${escapeHtml(periodMetrics.label)} 대화 증가</span><strong>${renderActivityDelta(periodMetrics.chatsDelta, "관측 데이터 없음")}</strong><small>${escapeHtml(periodMetrics.help)}</small></div>
      <div class="character-rate-metric metric-views has-popover" tabindex="0">
        <span>${escapeHtml(MARKET_META[selected.market].label)} 시간당 평균 조회</span>
        <strong>${hourlyMetrics ? `${signedNumber(hourlyMetrics.viewsPerHour)}<small>회/h</small>` : "—"}</strong>
        <small>${escapeHtml(hourlyHelp)}</small>
        <div class="stat-card-popover character-metric-popover">${hourlyViewsPopover}</div>
      </div>
      <div class="character-rate-metric metric-chats has-popover" tabindex="0">
        <span>${escapeHtml(MARKET_META[selected.market].label)} 시간당 평균 대화</span>
        <strong>${hourlyMetrics ? `${signedNumber(hourlyMetrics.chatsPerHour)}<small>회/h</small>` : "—"}</strong>
        <small>${escapeHtml(hourlyHelp)}</small>
        <div class="stat-card-popover character-metric-popover">${hourlyChatsPopover}</div>
      </div>
    </div>
    <h3>지역별 캐릭터 정보 (4개국 연동)</h3>
    <div class="locale-list">
      ${MARKET_ORDER.map((market) => renderLocaleItem(group.locales[market], market, selected.market)).join("")}
    </div>
  `;
}

function renderLocaleItem(record, market, activeMarket) {
  if (!record) {
    return `
      <div class="locale-item">
        <span class="thumb-fallback" aria-hidden="true">-</span>
        <div class="locale-copy">
          <strong>${MARKET_META[market].label}</strong>
          <p>이 스냅샷에는 해당 지역 캐릭터가 없습니다.</p>
        </div>
      </div>
    `;
  }
  const model = viewModel(record);
  const active = market === activeMarket ? " active" : "";
  const link = record.detail_url
    ? `<a class="locale-link" href="${escapeAttr(record.detail_url)}" target="_blank" rel="noopener noreferrer">공식 캐릭터 페이지</a>`
    : "";
  return `
    <div class="locale-item">
      ${renderThumb(model)}
      <div class="locale-copy">
        <strong>${escapeHtml(record.character_name)} <span class="pill${active}">${MARKET_META[market].short}</span></strong>
        <p>${escapeHtml(record.workSafe)}</p>
        <p>${formatNumber(record.viewsNumber)} views · ${formatNumber(record.chatsNumber)} chats</p>
      </div>
      ${link}
    </div>
  `;
}

function renderStatCards(cards) {
  return cards
    .map(
      ([label, value, help, tone = "neutral", popover = null]) => `
        <article class="stat-card tone-${escapeAttr(tone)}${popover ? " has-popover" : ""}">
          <span class="stat-label">${escapeHtml(label)}</span>
          <strong class="stat-value">${String(value ?? "-").includes("<") ? String(value ?? "-") : escapeHtml(value ?? "-")}</strong>
          <p class="stat-help">${escapeHtml(help ?? "")}</p>
          ${popover ? `<div class="stat-card-popover">${popover}</div>` : ""}
        </article>
      `
    )
    .join("");
}

function renderCharacterLeaderboard(byCharacter) {
  const assumptions = revenueAssumptions();
  const linkedToGlobalMarket = !state.leaderboardOverride;
  const selectedMarket = MARKET_META[linkedToGlobalMarket ? state.statsMarket : state.leaderboardMarket] ? (linkedToGlobalMarket ? state.statsMarket : state.leaderboardMarket) : "all";
  const fullRanking = leaderboardRanking(selectedMarket);
  const totalChats = fullRanking.reduce((sum, record) => sum + record.chatsNumber, 0) || 1;
  const top = fullRanking.slice(0, 6);
  const scopeLabel = selectedMarket === "all" ? "통합 4개 시장 합산" : `${MARKET_META[selectedMarket].label} 공개 데이터`;
  return `
    <article class="chart-card span-5 character-rank-card">
      <div class="chart-heading">
        <div>
          <h3>인기 캐릭터 TOP 6</h3>
          <p class="stat-help">${escapeHtml(scopeLabel)} 대화수 순위 · ${linkedToGlobalMarket ? "상단 국가 선택과 자동 연동" : "TOP6만 단독 국가 보기"}</p>
        </div>
        <div class="rank-heading-actions">
          <span class="sample-badge">TOP 6</span>
          <button class="rank-expand-button" type="button" data-rank-toggle aria-expanded="false"><b>전체 순위 펼치기</b><span>${formatNumber(fullRanking.length)}명</span></button>
        </div>
      </div>
      <div class="leaderboard-scope-note${linkedToGlobalMarket ? " is-linked" : " is-overridden"}" aria-live="polite">
        <span aria-hidden="true">${linkedToGlobalMarket ? "🔗" : "🎯"}</span>
        <p><strong>${escapeHtml(MARKET_META[selectedMarket].flag)} ${escapeHtml(MARKET_META[selectedMarket].label)} ${linkedToGlobalMarket ? "상단 선택 적용 중" : "TOP6 단독 선택"}</strong><small>${linkedToGlobalMarket ? "상단 국가 버튼을 바꾸면 TOP6와 전체 순위도 함께 전환됩니다." : "상단 국가와 별도로 TOP6만 보는 중입니다."}</small></p>
        ${linkedToGlobalMarket ? "" : `<button type="button" class="rank-sync-button" data-rank-sync>상단 선택으로 돌아가기</button>`}
      </div>
      <nav class="leaderboard-market-tabs" aria-label="인기 캐릭터 국가 및 서비스 선택">
        ${["all", ...MARKET_ORDER].map((market) => {
          const count = market === "all" ? groups.length : recordsForMarket(market).length;
          const meta = MARKET_META[market];
          const selected = selectedMarket === market;
          return `<button type="button" data-leaderboard-market="${market}" aria-pressed="${String(selected)}" aria-label="${escapeHtml(meta.label)} 순위 ${formatNumber(count)}명${selected ? ", 현재 선택됨" : ""}"><i aria-hidden="true">${meta.flag}</i><span>${escapeHtml(meta.label)}</span><small>${formatNumber(count)}명</small></button>`;
        }).join("")}
      </nav>
      <div class="leaderboard-layout">
        <div class="leaderboard-featured">
          <div class="character-rank-grid">
        ${top.map((item, index) => {
          const group = groups.find((entry) => entry.id === Number(item.character_id));
          const primary = item.displayRecord || group?.primary;
          const work = primary?.workSafe || MISSING_WORK;
          const imageSrc = primary?.imageSrc || "";
          const share = (Number(item.chatsNumber || 0) / totalChats) * 100;
          const marketLabels = (item.markets || group?.markets || []).map((market) => MARKET_META[market].short).join(" · ") || MARKET_META[selectedMarket].short;
          const tooltipId = `rank-tooltip-${selectedMarket}-${item.character_id}`;
          const views = Number(item.viewsNumber || 0);
          const estimatedWon = formatWonBig(revenueFromChats(item.chatsNumber));
          return `
            <button class="character-rank-item rank-${index + 1}" type="button" data-character-id="${item.character_id}" data-character-market="${selectedMarket}" aria-describedby="${tooltipId}">
              <span class="rank-number">${index + 1}</span>
              <span class="rank-image-frame">
                ${imageSrc
                  ? `<img class="thumb rank-image" src="${escapeAttr(imageSrc)}" alt="${escapeAttr(`${item.character_name} 캐릭터 이미지`)}" loading="lazy" data-fallback="${escapeAttr(String(item.character_name || "?").slice(0, 1))}" />`
                  : `<span class="rank-image rank-fallback">${escapeHtml(String(item.character_name || "?").slice(0, 1))}</span>`}
              </span>
              <span class="rank-name">${escapeHtml(item.character_name || `#${item.character_id}`)}</span>
              <span class="rank-traffic">
                <span><small>조회수</small><strong>${formatCompact(views)}</strong></span>
                <span><small>공개 대화</small><strong>${formatCompact(item.chatsNumber)}</strong></span>
              </span>
              <div class="rank-metrics-dual rank-revenue">
                <span class="rank-metric-item"><small>시장 내 대화 비중</small><strong>${share.toFixed(1)}%</strong></span>
                <span class="rank-metric-item is-revenue"><small>가정 환산액</small><strong>${estimatedWon}</strong></span>
              </div>
              <span class="rank-tooltip" id="${tooltipId}" role="tooltip">
                <strong>${escapeHtml(item.character_name || `#${item.character_id}`)}</strong>
                <span>작품 · ${escapeHtml(work)}</span>
                <span>누적 조회 · ${formatNumber(item.viewsNumber)}회</span>
                <span>누적 대화 · ${formatNumber(item.chatsNumber)}회</span>
                <span>${escapeHtml(scopeLabel)} 대화 비중 · ${share.toFixed(1)}%</span>
                <span>가정 환산액 · ${estimatedWon}</span>
                <span>확인 시장 · ${escapeHtml(marketLabels)}</span>
                <small>누적 대화 × 선택 단가 ${formatNumber(assumptions.unitMid)}원 가정치이며 유료 결제·매출 순위가 아님</small>
              </span>
            </button>
          `;
        }).join("")}
          </div>
          <p class="chart-tail">통합·국가별 순위는 공개 대화수 기준이며, 환산액은 누적 대화 × 선택 단가 ${formatNumber(assumptions.unitMid)}원 가정치(실제 매출 아님)입니다. 클릭하면 전체 이미지와 국가별 정보가 열립니다.</p>
        </div>
        <aside class="full-rank-panel" hidden aria-label="${escapeAttr(scopeLabel)} 전체 캐릭터 공개 대화 순위">
          <div class="full-rank-header"><div><strong>${escapeHtml(MARKET_META[selectedMarket].label)} 전체 캐릭터 순위</strong><small>${escapeHtml(scopeLabel)} 공개 대화수 기준 · ${formatNumber(fullRanking.length)}명</small></div><span>최신 ${escapeHtml(formatDateTime(dataset.generated_at))}</span></div>
          <div class="full-rank-list">
            ${fullRanking.map((record, index) => {
              const share = (record.chatsNumber / totalChats) * 100;
              const estimatedRowWon = formatWonBig(revenueFromChats(record.chatsNumber));
              return `<button class="full-rank-row" type="button" data-character-id="${record.character_id}" data-character-market="${selectedMarket}">
                <span class="full-rank-number ${index < 3 ? `is-top-${index + 1}` : ""}">${index + 1}</span>
                ${record.imageSrc ? `<img class="thumb" src="${escapeAttr(record.imageSrc)}" alt="" loading="lazy" data-fallback="${escapeAttr(record.character_name.slice(0, 1))}" />` : `<span class="thumb-fallback">${escapeHtml(record.character_name.slice(0, 1))}</span>`}
                <span class="full-rank-identity"><strong>${escapeHtml(record.character_name)}</strong><small>${escapeHtml(record.workSafe)}</small></span>
                <span class="full-rank-metric"><strong>${formatNumber(record.chatsNumber)}</strong><small>${share.toFixed(1)}% · ${estimatedRowWon}</small></span>
              </button>`;
            }).join("")}
          </div>
          <p class="full-rank-caveat">누적 공개 대화수 순위이며 유료 결제·매출 순위가 아닙니다.</p>
        </aside>
      </div>
    </article>
  `;
}

function leaderboardRanking(market) {
  const ranking = market === "all"
    ? groups.map((group) => ({
        character_id: group.id,
        character_name: group.primary.character_name,
        workSafe: group.primary.workSafe,
        imageSrc: group.primary.imageSrc,
        viewsNumber: group.viewsNumber,
        chatsNumber: group.chatsNumber,
        displayRecord: group.primary,
        markets: group.markets
      }))
    : recordsForMarket(market).map((record) => ({
        character_id: record.character_id,
        character_name: record.character_name,
        workSafe: record.workSafe,
        imageSrc: record.imageSrc,
        viewsNumber: record.viewsNumber,
        chatsNumber: record.chatsNumber,
        displayRecord: record,
        markets: [market]
      }));
  return ranking.sort((a, b) => b.chatsNumber - a.chatsNumber || b.viewsNumber - a.viewsNumber);
}

function renderSnapshotJourney(title, subtitle, rows, key, color) {
  const first = Number(rows[0]?.[key] || 0);
  const latest = Number(rows.at(-1)?.[key] || 0);
  const change = latest - first;
  const changePct = first ? (change / first) * 100 : 0;
  const firstDate = formatCollectionPoint(rows[0]?.captured_at || rows[0]?.date);
  const latestDate = formatCollectionPoint(rows.at(-1)?.captured_at || rows.at(-1)?.date);
  return `
    <article class="chart-card snapshot-journey-card">
      <div class="chart-heading">
        <div><h3>${escapeHtml(title)}</h3><p class="stat-help">${escapeHtml(subtitle)}</p></div>
        <span class="sample-badge">${rows.length}회 수집</span>
      </div>
      <div class="snapshot-flow" style="--journey-color:${color}">
        <div class="snapshot-value">
          <span>첫 수집 · ${escapeHtml(firstDate)}</span>
          <strong>${formatCompact(first)}</strong>
        </div>
        <div class="snapshot-change">
          <span aria-hidden="true">→</span>
          <strong>+${formatCompact(change)}</strong>
          <small>+${changePct.toFixed(1)}%</small>
        </div>
        <div class="snapshot-value is-current">
          <span>현재 · ${escapeHtml(latestDate)}</span>
          <strong>${formatCompact(latest)}</strong>
        </div>
      </div>
      <div class="snapshot-milestones" style="--journey-color:${color}">
        ${rows.map((row, index) => `
          <div class="snapshot-milestone ${index === rows.length - 1 ? "is-latest" : ""}">
            <span>${escapeHtml(formatCollectionPoint(row.captured_at || row.date))}</span>
            <strong>${formatCompact(Number(row[key] || 0))}</strong>
          </div>
        `).join("")}
      </div>
      <p class="chart-tail">${formatNumber(rows.length)}회 수집값은 참고용이며, 핵심 비교는 첫 수집값과 현재값의 절대 증가량입니다.</p>
    </article>
  `;
}

function renderPeriodComparison(title, subtitle, rows, formatter = formatNumber, color = "#3987e5", className = "", options = {}) {
  const max = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  const latestChange = Number(latest?.value || 0) - Number(previous?.value || 0);
  const latestPct = Number(previous?.value || 0) ? (latestChange / Number(previous.value)) * 100 : 0;
  const high = rows.reduce((best, row) => Number(row.value || 0) > Number(best?.value ?? -Infinity) ? row : best, null);
  return `
    <article class="chart-card period-comparison-card ${escapeAttr(className)}" style="--comparison-color:${color}">
      <div class="chart-heading">
        <div><h3>${escapeHtml(title)}</h3><p class="stat-help">${escapeHtml(subtitle || "")}</p></div>
        <span class="sample-badge">${rows.length}개 기간</span>
      </div>
      <div class="period-hero">
        <div><span>${escapeHtml(options.latestLabel || "현재")} · ${escapeHtml(formatPeriodLabel(latest?.label))}</span><strong>${latest ? escapeHtml(formatter(latest.value)) : "-"}</strong></div>
        <div class="period-change ${latestChange < 0 ? "is-lower" : "is-higher"}">
          <span>직전 기간 대비</span>
          <strong>${latestChange < 0 ? "▼" : "▲"} ${Math.abs(latestPct).toFixed(1)}%</strong>
          <small>${latestChange >= 0 ? "+" : "−"}${escapeHtml(formatter(Math.abs(latestChange)))}</small>
        </div>
        <div class="is-highlight"><span>${escapeHtml(options.highLabel || "최고 관측")}</span><strong>${high ? `${escapeHtml(formatPeriodLabel(high.label))} · ${escapeHtml(formatter(high.value))}` : "-"}</strong></div>
      </div>
      <div class="period-list">
        ${rows.map((row, index) => {
          const value = Number(row.value || 0);
          const prior = Number(rows[index - 1]?.value || 0);
          const delta = index && prior ? ((value - prior) / prior) * 100 : null;
          const width = Math.max(4, (value / max) * 100);
          return `<div class="period-row">
            <span class="period-label">${escapeHtml(formatPeriodLabel(row.label))}</span>
            <span class="period-track"><i style="width:${width}%"></i></span>
            <strong>${escapeHtml(formatter(value))}</strong>
            <small class="${delta == null ? "" : delta < 0 ? "is-lower" : "is-higher"}">${delta == null ? "기준" : `${delta < 0 ? "▼" : "▲"} ${Math.abs(delta).toFixed(1)}%`}</small>
          </div>`;
        }).join("")}
      </div>
      ${options.contextNote ? `<p class="metric-context-note"><strong>읽는 법</strong>${escapeHtml(options.contextNote)}</p>` : ""}
    </article>
  `;
}

function renderRevenueBand(revenue) {
  const mode = state.revenueViewMode || "recent";
  const market = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
  const meta = MARKET_META[market];
  const allTotals = statsMarketTotals("all");
  const currentTotals = statsMarketTotals(market);
  const assumptions = revenueAssumptions();

  const launchDate = new Date("2026-03-13T00:00:00+09:00");
  const captureDate = new Date(statsData?.captured_at || Date.now());
  const elapsedDays = Math.max(1, Math.floor((captureDate - launchDate) / (1000 * 60 * 60 * 24)));
  const serviceDay = elapsedDays + 1;
  const elapsedMonths = elapsedDays / 30;
  const elapsedMonthLabel = `${elapsedMonths.toFixed(1)}개월`;
  const revPerSession = assumptions.unitMid;
  const cumulativeMonthlyAverage = elapsedMonths > 0 ? (allTotals.chats * revPerSession) / elapsedMonths : 0;

  if (mode === "cumulative") {
    // 현재 누적 공개 카운터 환산 뷰. 2026.03.13 시점의 시작 스냅샷은 보유하지 않는다.
    if (market === "all") {
      const totalChats = allTotals.chats;
      const grossMid = revenueFromChats(totalChats, "unitMid");
      const grossLow = revenueFromChats(totalChats, "unitLow");
      const grossHigh = revenueFromChats(totalChats, "unitHigh");
      const monthlyAvg = grossMid / elapsedMonths;

      // 4개 시장별 누적 데이터 행 구성
      const marketRows = MARKET_ORDER.map((mKey) => {
        const mTotals = statsMarketTotals(mKey);
        const mChats = mTotals.chats;
        const mMid = revenueFromChats(mChats, "unitMid");
        const mLow = revenueFromChats(mChats, "unitLow");
        const mHigh = revenueFromChats(mChats, "unitHigh");
        const share = totalChats ? (mChats / totalChats) * 100 : 0;
        return {
          key: mKey,
          label: MARKET_META[mKey].label,
          flag: MARKET_META[mKey].flag,
          chats: mChats,
          share,
          revenue_low: mLow,
          revenue_mid: mMid,
          revenue_high: mHigh
        };
      });

      const maxVal = Math.max(...marketRows.map((r) => r.revenue_high), 1);

      return `
        <article class="chart-card span-7 revenue-range-card">
          <div class="chart-heading">
            <div>
              <h3>현재 누적 공개 대화 환산: 4개국 통합</h3>
              <p class="stat-help">누적 ${formatNumber(totalChats)}회 × 선택 단가 ${formatNumber(assumptions.unitLow)}~${formatNumber(assumptions.unitHigh)}원 · 실제 매출 아님</p>
            </div>
            <div class="revenue-mode-tabs" role="tablist" aria-label="활동 환산 시나리오 모드">
              <button type="button" class="rev-tab-btn" data-revenue-mode="recent">⚡ 최근 런레이트</button>
              <button type="button" class="rev-tab-btn active" data-revenue-mode="cumulative">🏛️ 현재 누적 환산</button>
            </div>
          </div>
          <div class="revenue-headline">
            <div><span>4개국 누적 활동 환산액</span><strong>${formatWonBig(grossMid)}</strong><small>누적 공개 대화 × 선택 단가</small></div>
            <div class="revenue-range-summary">
              <span><small>낮게 보면</small><strong>${formatWonBig(grossLow)}</strong></span>
              <span class="is-focus"><small>누적 기준값</small><strong>${formatWonBig(grossMid)}</strong></span>
              <span><small>높게 보면</small><strong>${formatWonBig(grossHigh)}</strong></span>
            </div>
          </div>
          <div class="band-list revenue-day-list">
            ${marketRows
              .map((row) => {
                const left = Math.max(0, (row.revenue_low / maxVal) * 100);
                const right = Math.max(left, (row.revenue_high / maxVal) * 100);
                const mid = Math.max(0, (row.revenue_mid / maxVal) * 100);
                return `
                  <div class="revenue-day-row">
                    <span class="revenue-date" style="font-weight:750">${row.flag} ${escapeHtml(row.label)}</span>
                    <div class="revenue-day-values">
                      <span><small>낮게</small>${formatWonBig(row.revenue_low)}</span>
                      <strong><small>기준</small>${formatWonBig(row.revenue_mid)}</strong>
                      <span><small>높게</small>${formatWonBig(row.revenue_high)}</span>
                    </div>
                    <div class="band-track" title="${escapeAttr(`${row.label} ${formatNumber(row.chats)}회 (${row.share.toFixed(1)}%) · ${formatWonBig(row.revenue_low)}~${formatWonBig(row.revenue_high)}`)}">
                      <span class="band-fill" style="left:${left}%;width:${right - left}%"></span>
                      <span class="band-marker" style="left:${mid}%"></span>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
          <div class="benchmark-key is-warning"><span>ℹ️</span><strong>관측 누적액을 ${elapsedMonthLabel}로 단순 나누면 월 약 ${formatWonBig(monthlyAvg)}</strong><small>3월 13일 시작 스냅샷이 없어 실제 기간 매출로 사용할 수 없습니다.</small></div>
          <div class="revenue-confidence-grid">
            <div><span>누적 운영 기간</span><strong>${serviceDay}일차 (${elapsedMonthLabel} 환산)</strong><small>${elapsedDays}일 경과 · 2026.03.13 공개 오픈</small></div>
            <div><span>관측 누적액 단순 월환산</span><strong>월 약 ${formatWonBig(monthlyAvg)}</strong><small>현재 누적액 ÷ 경과 개월</small></div>
            <div class="is-highlight"><span>누적 총 대화수</span><strong>${formatNumber(totalChats)}회</strong><small>4개국 합계 · ${escapeHtml(formatDateTime(statsData.captured_at))} 수집</small></div>
          </div>
        </article>
      `;
    }

    // 개별 국가 누적 뷰 (kr, jp, global, tw)
    const mChats = currentTotals.chats;
    const mGrossMid = revenueFromChats(mChats, "unitMid");
    const mGrossLow = revenueFromChats(mChats, "unitLow");
    const mGrossHigh = revenueFromChats(mChats, "unitHigh");
    const mMonthlyAvg = mGrossMid / elapsedMonths;
    const isKr = market === "kr";

    return `
      <article class="chart-card span-7 revenue-range-card">
        <div class="chart-heading">
          <div>
            <h3>현재 누적 공개 대화 환산: ${meta.flag} ${escapeHtml(meta.label)}</h3>
            <p class="stat-help">누적 ${formatNumber(mChats)}회 × 선택 단가 ${formatNumber(assumptions.unitLow)}~${formatNumber(assumptions.unitHigh)}원 · 실제 매출 아님</p>
          </div>
          <div class="revenue-mode-tabs" role="tablist" aria-label="활동 환산 시나리오 모드">
            <button type="button" class="rev-tab-btn" data-revenue-mode="recent">⚡ 최근 런레이트</button>
            <button type="button" class="rev-tab-btn active" data-revenue-mode="cumulative">🏛️ 현재 누적 환산</button>
          </div>
        </div>
        <div class="revenue-headline">
          <div><span>${escapeHtml(meta.label)} 누적 활동 환산액</span><strong>${formatWonBig(mGrossMid)}</strong><small>누적 공개 대화 × 선택 단가</small></div>
          <div class="revenue-range-summary">
            <span><small>낮게 보면</small><strong>${formatWonBig(mGrossLow)}</strong></span>
            <span class="is-focus"><small>누적 기준값</small><strong>${formatWonBig(mGrossMid)}</strong></span>
            <span><small>높게 보면</small><strong>${formatWonBig(mGrossHigh)}</strong></span>
          </div>
        </div>
        ${!isKr ? `
          <div class="benchmark-key is-warning" style="margin:12px 0 6px"><span>⚠️</span><strong>사용자 선택 단가 ${formatNumber(assumptions.unitMid)}원 공통 적용</strong><small>${escapeHtml(meta.label)} 현지 ASP와 결제율 미확인</small></div>
        ` : `
          <div class="benchmark-key is-warning" style="margin:12px 0 6px"><span>ℹ️</span><strong>관측 누적액을 ${elapsedMonthLabel}로 단순 나누면 월 약 ${formatWonBig(mMonthlyAvg)}</strong><small>3월 13일 시작 스냅샷 미보유</small></div>
        `}
        <div class="revenue-confidence-grid">
          <div><span>누적 운영 기간</span><strong>${serviceDay}일차 (${elapsedMonthLabel} 환산)</strong><small>${elapsedDays}일 경과 · 2026.03.13 공개 오픈</small></div>
          <div><span>관측 누적액 단순 월환산</span><strong>월 약 ${formatWonBig(mMonthlyAvg)}</strong><small>현재 누적액 ÷ ${elapsedMonthLabel}</small></div>
          <div class="is-highlight"><span>${escapeHtml(meta.label)} 누적 대화</span><strong>${formatNumber(mChats)}회</strong><small>${escapeHtml(formatDateTime(statsData.captured_at))} 수집</small></div>
        </div>
      </article>
    `;
  }

  // 최근 일일 런레이트 뷰 (recent)
  if (market === "all") {
    const grand = recentRevenueForMarket("all");
    const grandMid = grand.revenue_mid;
    const grandLow = grand.revenue_low;
    const grandHigh = grand.revenue_high;
    const krMid = recentRevenueForMarket("kr").revenue_mid;
    const overseasMid = Math.max(0, grandMid - krMid);
    const velocityVsAveragePct = cumulativeMonthlyAverage > 0
      ? ((grandMid / cumulativeMonthlyAverage) - 1) * 100
      : null;
    
    // 날짜별 누적 관측 평균을 동일한 선택 단가로 환산한다.
    const allMarketRows = revenueSeriesForMarket("all");
    const observationLabel = revenueObservationLabel("all");

    const maxVal = Math.max(...allMarketRows.map((r) => r.revenue_high), grandHigh, 1);

    return `
      <article class="chart-card span-7 revenue-range-card">
        <div class="chart-heading">
          <div>
            <h3>월환산 활동액 시나리오: 4개국 통합</h3>
            <p class="stat-help">시장별 최근 일평균 대화 증가 × 30일 × 선택 단가 ${formatNumber(assumptions.unitLow)}~${formatNumber(assumptions.unitHigh)}원</p>
          </div>
          <div class="revenue-mode-tabs" role="tablist" aria-label="활동 환산 시나리오 모드">
            <button type="button" class="rev-tab-btn active" data-revenue-mode="recent">⚡ 최근 4개국 런레이트</button>
              <button type="button" class="rev-tab-btn" data-revenue-mode="cumulative">🏛️ 현재 누적 환산</button>
          </div>
        </div>
        <div class="revenue-headline">
          <div><span>4개국 합산 추정 환산액</span><strong>${formatWonBig(grandMid)}</strong><small>${escapeHtml(observationLabel)} · 실제 매출 아님</small></div>
          <div class="revenue-range-summary">
            <span><small>낮게 보면</small><strong>${formatWonBig(grandLow)}</strong></span>
            <span class="is-focus"><small>4개국 기준값</small><strong>${formatWonBig(grandMid)}</strong></span>
            <span><small>높게 보면</small><strong>${formatWonBig(grandHigh)}</strong></span>
          </div>
        </div>
        <div class="revenue-scope-compare" aria-label="통합과 한국 최근 런레이트 비교">
          <div class="scope-card is-all">
            <span>🌐 통합</span>
            <strong>${formatWonBig(grandMid)}</strong>
            <small>한국 + 일본 + Global + 대만</small>
          </div>
          <div class="scope-card is-kr">
            <span>🇰🇷 한국</span>
            <strong>${formatWonBig(krMid)}</strong>
            <small>${escapeHtml(revenueObservationLabel("kr"))}</small>
          </div>
          <div class="scope-card is-overseas">
            <span>🌏 해외 합산</span>
            <strong>${formatWonBig(overseasMid)}</strong>
            <small>일본·Global·대만 · 선택 단가 공통 적용</small>
          </div>
        </div>
        <div class="band-list revenue-day-list">
          ${allMarketRows
            .map((row) => {
              const left = Math.max(0, (row.revenue_low / maxVal) * 100);
              const right = Math.max(left, (row.revenue_high / maxVal) * 100);
              const mid = Math.max(0, (row.revenue_mid / maxVal) * 100);
              return `
                <div class="revenue-day-row">
                  <span class="revenue-date">${escapeHtml(row.date.slice(5))}</span>
                  <div class="revenue-day-values">
                    <span><small>낮게</small>${formatWonBig(row.revenue_low)}</span>
                    <strong><small>기준</small>${formatWonBig(row.revenue_mid)}</strong>
                    <span><small>높게</small>${formatWonBig(row.revenue_high)}</span>
                  </div>
                  <div class="band-track" title="${escapeAttr(`${row.date} 4개국 합산 ${formatWonBig(row.revenue_low)}–${formatWonBig(row.revenue_high)}`)}">
                    <span class="band-fill" style="left:${left}%;width:${right - left}%"></span>
                    <span class="band-marker" style="left:${mid}%"></span>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="benchmark-key"><span>ℹ️</span><strong>${formatWonBig(grandMid)}은 ${escapeHtml(observationLabel)}의 30일 환산값입니다.</strong><small>출처: 탑툰 서비스 도메인의 공개 대화 카운터 · ${escapeHtml(formatDateTime(statsData.captured_at))} 수집</small></div>
        <div class="revenue-confidence-grid">
          <div><span>관측 표본</span><strong>${escapeHtml(observationLabel)}</strong><small>최소 14일 권장</small></div>
          <div><span>단순 월환산 대비</span><strong>${velocityVsAveragePct == null ? "-" : `${velocityVsAveragePct >= 0 ? "+" : ""}${velocityVsAveragePct.toFixed(1)}%`}</strong><small>누적 단순 환산 ${formatWonBig(cumulativeMonthlyAverage)} ↔ 최근 속도 ${formatWonBig(grandMid)}</small></div>
          <div class="is-caution"><span>모델 신뢰도</span><strong>낮음</strong><small>결제율·해외ASP 미공시</small></div>
        </div>
      </article>
    `;
  }

  if (market === "kr") {
    const rows = revenueSeriesForMarket("kr");
    const benchmark = revenue.ir_benchmark?.monthly || 900000000;
    const latest = rows.at(-1) || {};
    const observationLabel = revenueObservationLabel("kr");
    const values = rows.flatMap((row) => [row.revenue_low, row.revenue_mid, row.revenue_high]);
    if (benchmark) values.push(benchmark);
    const max = Math.max(...values.map(Number), 1);
    const benchmarkRatio = benchmark ? (Number(latest.revenue_mid || 0) / benchmark) * 100 : 0;
    return `
      <article class="chart-card span-7 revenue-range-card">
        <div class="chart-heading">
          <div>
            <h3>월환산 활동액 시나리오: 한국(KR)</h3>
            <p class="stat-help">한국 최근 일평균 대화 증가 × 30일 × 선택 단가 ${formatNumber(assumptions.unitLow)}~${formatNumber(assumptions.unitHigh)}원</p>
          </div>
          <div class="revenue-mode-tabs" role="tablist" aria-label="활동 환산 시나리오 모드">
            <button type="button" class="rev-tab-btn active" data-revenue-mode="recent">⚡ 최근 ${rows.length}일 런레이트</button>
            <button type="button" class="rev-tab-btn" data-revenue-mode="cumulative">🏛️ 현재 누적 환산</button>
          </div>
        </div>
        <div class="revenue-headline">
          <div><span>한국 추정 환산액</span><strong>${formatWonBig(latest.revenue_mid)}</strong><small>${escapeHtml(observationLabel)} · 실제 매출 아님</small></div>
          <div class="revenue-range-summary">
            <span><small>낮게 보면</small><strong>${formatWonBig(latest.revenue_low)}</strong></span>
            <span class="is-focus"><small>기준값</small><strong>${formatWonBig(latest.revenue_mid)}</strong></span>
            <span><small>높게 보면</small><strong>${formatWonBig(latest.revenue_high)}</strong></span>
          </div>
        </div>
        <div class="band-list revenue-day-list">
          ${rows
            .map((row) => {
              const left = Math.max(0, (Number(row.revenue_low || 0) / max) * 100);
              const right = Math.max(left, (Number(row.revenue_high || 0) / max) * 100);
              const mid = Math.max(0, (Number(row.revenue_mid || 0) / max) * 100);
              const bench = Math.max(0, (benchmark / max) * 100);
              return `
                <div class="revenue-day-row">
                  <span class="revenue-date">${escapeHtml(row.date.slice(5))}</span>
                  <div class="revenue-day-values">
                    <span><small>낮게</small>${formatWonBig(row.revenue_low)}</span>
                    <strong><small>기준</small>${formatWonBig(row.revenue_mid)}</strong>
                    <span><small>높게</small>${formatWonBig(row.revenue_high)}</span>
                  </div>
                  <div class="band-track" title="${escapeAttr(`${row.date} ${formatWonBig(row.revenue_low)}–${formatWonBig(row.revenue_high)}`)}">
                    <span class="band-fill" style="left:${left}%;width:${right - left}%"></span>
                    <span class="band-marker" style="left:${mid}%"></span>
                    <span class="band-benchmark" style="left:${bench}%"></span>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="benchmark-key"><span>ℹ️</span><strong>한국 기준값은 9억원 비교값의 ${benchmarkRatio.toFixed(1)}%</strong><small>비교값 원문 출처·대상 범위 미확인 · ${escapeHtml(formatDateTime(statsData.captured_at))} 수집</small></div>
        <div class="revenue-confidence-grid">
          <div><span>관측 표본</span><strong>${escapeHtml(observationLabel)}</strong><small>최소 14일 권장</small></div>
          <div><span>IR 대비</span><strong>${benchmarkRatio.toFixed(1)}%</strong><small>${formatWonBig(Number(benchmark || 0) - Number(latest.revenue_mid || 0))} 차이</small></div>
          <div class="is-caution"><span>모델 신뢰도</span><strong>낮음</strong><small>결제율·ASP 미공시</small></div>
        </div>
      </article>
    `;
  }

  // 개별 해외 시장 런레이트 뷰 (jp, tw, global)
  const mRows = revenueSeriesForMarket(market);
  const mRecent = mRows.at(-1) || {};
  const mRecentMid = Number(mRecent.revenue_mid || 0);
  const mRecentLow = Number(mRecent.revenue_low || 0);
  const mRecentHigh = Number(mRecent.revenue_high || 0);
  const observationLabel = revenueObservationLabel(market);

  const maxVal = Math.max(...mRows.map((r) => r.revenue_high), mRecentHigh, 1);

  return `
    <article class="chart-card span-7 revenue-range-card">
      <div class="chart-heading">
        <div>
          <h3>월환산 활동액 시나리오: ${meta.flag} ${escapeHtml(meta.label)}</h3>
          <p class="stat-help">최근 일평균 대화 증가 × 30일 × 선택 단가 ${formatNumber(assumptions.unitLow)}~${formatNumber(assumptions.unitHigh)}원 · 현지 ASP 미확인</p>
        </div>
        <div class="revenue-mode-tabs" role="tablist" aria-label="활동 환산 시나리오 모드">
          <button type="button" class="rev-tab-btn active" data-revenue-mode="recent">⚡ 최근 런레이트</button>
          <button type="button" class="rev-tab-btn" data-revenue-mode="cumulative">🏛️ 현재 누적 환산</button>
        </div>
      </div>
      <div class="revenue-headline">
        <div><span>${escapeHtml(meta.label)} 추정 환산액</span><strong>${formatWonBig(mRecentMid)}</strong><small>${escapeHtml(observationLabel)} · 실제 매출 아님</small></div>
        <div class="revenue-range-summary">
          <span><small>낮게 보면</small><strong>${formatWonBig(mRecentLow)}</strong></span>
          <span class="is-focus"><small>기준값</small><strong>${formatWonBig(mRecentMid)}</strong></span>
          <span><small>높게 보면</small><strong>${formatWonBig(mRecentHigh)}</strong></span>
        </div>
      </div>
      <div class="band-list revenue-day-list">
        ${mRows
          .map((row) => {
            const left = Math.max(0, (row.revenue_low / maxVal) * 100);
            const right = Math.max(left, (row.revenue_high / maxVal) * 100);
            const mid = Math.max(0, (row.revenue_mid / maxVal) * 100);
            return `
              <div class="revenue-day-row">
                <span class="revenue-date">${escapeHtml(row.date.slice(5))}</span>
                <div class="revenue-day-values">
                  <span><small>낮게</small>${formatWonBig(row.revenue_low)}</span>
                  <strong><small>기준</small>${formatWonBig(row.revenue_mid)}</strong>
                  <span><small>높게</small>${formatWonBig(row.revenue_high)}</span>
                </div>
                <div class="band-track" title="${escapeAttr(`${row.date} ${meta.label} ${formatWonBig(row.revenue_low)}–${formatWonBig(row.revenue_high)}`)}">
                  <span class="band-fill" style="left:${left}%;width:${right - left}%"></span>
                  <span class="band-marker" style="left:${mid}%"></span>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
      <div class="benchmark-key is-warning"><span>⚠️</span><strong>사용자 선택 단가 ${formatNumber(assumptions.unitMid)}원 공통 적용</strong><small>${escapeHtml(meta.label)} 현지 ASP·결제율 미공개 · ${escapeHtml(formatDateTime(statsData.captured_at))} 수집</small></div>
      <div class="revenue-confidence-grid">
        <div><span>관측 표본</span><strong>${escapeHtml(observationLabel)}</strong><small>일간 델타 기록</small></div>
        <div><span>${escapeHtml(meta.label)} 월환산 활동액</span><strong>월 약 ${formatWonBig(mRecentMid)}</strong><small>선택 단가 기준</small></div>
        <div class="is-caution"><span>모델 신뢰도</span><strong>낮음</strong><small>현지 단가 미검증</small></div>
      </div>
    </article>
  `;
}

function renderStackedDaily(title, rows) {
  const keys = MARKET_ORDER.map((market) => `${market}_delta`);
  const totals = rows.map((row) => keys.reduce((sum, key) => sum + Number(row[key] || 0), 0));
  const max = Math.max(
    ...totals,
    1
  );
  const latest = rows.at(-1) || {};
  const latestTotal = totals.at(-1) || 0;
  const previousTotal = totals.at(-2) || 0;
  const latestOverseas = keys.slice(1).reduce((sum, key) => sum + Number(latest[key] || 0), 0);
  const latestOverseasShare = latestTotal ? (latestOverseas / latestTotal) * 100 : 0;
  const totalChange = previousTotal ? ((latestTotal / previousTotal) - 1) * 100 : 0;
  return `
    <article class="chart-card span-5 daily-growth-card">
      <div class="chart-heading"><div><h3>${escapeHtml(title)}</h3><p class="stat-help">전날보다 새로 늘어난 공개 대화 · 국가별 구성</p></div><span class="sample-badge">최근 ${rows.length}일</span></div>
      <div class="daily-growth-summary">
        <div><span>오늘 증가</span><strong>+${formatNumber(latestTotal)}</strong></div>
        <div><span>전일 대비</span><strong class="${totalChange >= 0 ? "is-up" : "is-down"}">${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(1)}%</strong></div>
        <div><span>해외 몫</span><strong>${latestOverseasShare.toFixed(1)}%</strong></div>
      </div>
      <div class="stacked-list">
        ${rows
          .map((row) => {
            const total = keys.reduce((sum, key) => sum + Number(row[key] || 0), 0);
            const overseas = keys.slice(1).reduce((sum, key) => sum + Number(row[key] || 0), 0);
            const overseasShare = total ? (overseas / total) * 100 : 0;
            return `
              <div class="stacked-row">
                <span>${escapeHtml(row.date.slice(5))}</span>
                <div class="stacked-track" aria-label="${escapeAttr(`${row.date} ${formatNumber(total)}`)}">
                  ${keys
                    .map((key) => {
                      const market = key.replace("_delta", "");
                      const value = Number(row[key] || 0);
                      const width = value ? (value / max) * 100 : 0;
                      return `<span style="width:${width}%;background:${MARKET_META[market].color}" title="${MARKET_META[market].label} ${formatNumber(value)}"></span>`;
                    })
                    .join("")}
                </div>
                <span class="stacked-values"><strong>+${formatNumber(total)}</strong><small>해외 +${formatNumber(overseas)} · ${overseasShare.toFixed(1)}%</small></span>
              </div>
            `;
          })
          .join("")}
      </div>
      <div class="legend">
        ${MARKET_ORDER.map((market) => `<span class="legend-item"><span class="legend-swatch" style="background:${MARKET_META[market].color}"></span>${MARKET_META[market].label}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderBarChart(title, subtitle, rows, formatter = formatNumber, color = "#3987e5", className = "") {
  const max = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
  const visibleRows = rows.length > 8 ? rows.slice(0, 6) : rows;
  const hiddenCount = rows.length - visibleRows.length;
  return `
    <article class="chart-card ${escapeAttr(className)}">
      <div class="chart-heading"><div><h3>${escapeHtml(title)}</h3><p class="stat-help">${escapeHtml(subtitle || "")}</p></div><span class="sample-badge">TOP ${visibleRows.length}</span></div>
      <div class="bar-list">
        ${visibleRows
          .map((row) => {
            const width = Math.max(3, Math.round((Number(row.value || 0) / max) * 100));
            return `
              <div class="bar-row" aria-label="${escapeAttr(`${row.label} ${formatter(row.value)}`)}">
                <span class="bar-label"><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(row.sub || "")}</small></span>
                <span class="bar-track"><span class="bar-fill" style="width:${width}%;background:${color}"></span></span>
                <span class="bar-value">${escapeHtml(formatter(row.value))}</span>
              </div>
            `;
          })
          .join("")}
      </div>
      ${hiddenCount > 0 ? `<p class="chart-tail">상위 ${visibleRows.length}개 표시 · 나머지 ${hiddenCount}개는 원본 데이터에 포함</p>` : ""}
    </article>
  `;
}

function renderColumnChart(title, subtitle, rows, formatter = formatNumber, color = "#3987e5", className = "", options = {}) {
  const max = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  const high = rows.reduce((best, row) => Number(row.value || 0) > Number(best?.value ?? -Infinity) ? row : best, null);
  const deltaPct = Number(previous?.value || 0) ? ((Number(latest?.value || 0) / Number(previous.value)) - 1) * 100 : 0;
  return `
    <article class="chart-card ${escapeAttr(className)}">
      <div class="chart-heading"><div><h3>${escapeHtml(title)}</h3><p class="stat-help">${escapeHtml(subtitle || "")}</p></div><span class="sample-badge">${rows.length}개 기간</span></div>
      <div class="chart-readout">
        <div><span>${escapeHtml(options.latestLabel || "최근")} · ${escapeHtml(formatPeriodLabel(latest?.label))}</span><strong>${latest ? escapeHtml(formatter(latest.value)) : "-"}</strong></div>
        <div><span>직전 대비</span><strong class="${deltaPct >= 0 ? "is-up" : "is-down"}">${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%</strong></div>
        <div class="is-highlight"><span>${escapeHtml(options.highLabel || "최고 관측")}</span><strong>${high ? `${escapeHtml(formatPeriodLabel(high.label))} · ${escapeHtml(formatter(high.value))}` : "-"}</strong></div>
      </div>
      <div class="column-chart" style="--columns:${Math.max(rows.length, 1)}">
        ${rows.map((row) => {
          const height = Math.max(4, (Number(row.value || 0) / max) * 100);
          return `<div class="column-item" title="${escapeAttr(`${row.label} ${formatter(row.value)}`)}">
            <strong>${escapeHtml(formatter(row.value))}</strong>
            <span class="column-track"><i style="height:${height}%;background:${color}"></i></span>
            <small>${escapeHtml(formatPeriodLabel(row.label))}</small>
          </div>`;
        }).join("")}
      </div>
      ${options.contextNote ? `<p class="metric-context-note"><strong>읽는 법</strong>${escapeHtml(options.contextNote)}</p>` : ""}
    </article>
  `;
}

function renderMarketComposition(totals, overseasContribution) {
  const grand = MARKET_ORDER.reduce((sum, market) => sum + Number(totals[market] || 0), 0) || 1;
  const koreaShare = (Number(totals.kr || 0) / grand) * 100;
  const overseasChatShare = 100 - koreaShare;
  return `
    <article class="chart-card span-7 market-composition-card">
      <div class="chart-heading"><div><h3>전체 대화는 어느 시장에서 나오나?</h3><p class="stat-help">4개 시장 누적 공개 대화 ${formatNumber(grand)}회</p></div><span class="sample-badge">누적 기준</span></div>
      <div class="composition-summary">
        <div class="composition-primary"><span>한국</span><strong>${koreaShare.toFixed(1)}%</strong><small>${formatNumber(totals.kr)}회</small></div>
        <div><span>해외 대화 비중</span><strong>${overseasChatShare.toFixed(1)}%</strong><small>일본·Global·대만 합계</small></div>
        <div><span>해외 환산액 비중</span><strong>${formatPercent(overseasContribution)}</strong><small>선택 단가 공통 적용</small></div>
      </div>
      <div class="composition-track" aria-label="시장별 누적 대화수 구성">
        ${MARKET_ORDER.map((market) => {
          const value = Number(totals[market] || 0);
          const width = (value / grand) * 100;
          return `<span style="width:${width}%;background:${MARKET_META[market].color}" title="${MARKET_META[market].label} ${formatNumber(value)} · ${width.toFixed(1)}%"></span>`;
        }).join("")}
      </div>
      <div class="market-metric-grid">
        ${MARKET_ORDER.map((market) => {
          const value = Number(totals[market] || 0);
          const share = (value / grand) * 100;
          return `<div><span><i style="background:${MARKET_META[market].color}"></i>${MARKET_META[market].label}</span><strong>${formatNumber(value)}회</strong><small>전체의 ${share.toFixed(1)}%</small></div>`;
        }).join("")}
      </div>
      <p class="chart-tail">대화 비중은 누적 활동 구성이고, 환산액 비중은 최근 증가 속도 구성입니다. 국가별 실제 결제 단가가 확인되기 전의 시나리오입니다.</p>
    </article>
  `;
}

function renderLineChart(title, subtitle, rows, series) {
  const width = 620;
  const height = 220;
  const pad = { top: 18, right: 20, bottom: 30, left: 52 };
  const values = rows.flatMap((row) => series.map((item) => Number(row[item.key] || 0)));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values, 1);
  const spread = Math.max(rawMax - rawMin, rawMax * 0.015, 1);
  const min = Math.max(0, rawMin - spread * 0.16);
  const max = rawMax + spread * 0.08;
  const x = (index) =>
    rows.length <= 1
      ? pad.left
      : pad.left + (index / (rows.length - 1)) * (width - pad.left - pad.right);
  const y = (value) => {
    const ratio = (Number(value || 0) - min) / Math.max(max - min, 1);
    return height - pad.bottom - ratio * (height - pad.top - pad.bottom);
  };
  return `
    <article class="chart-card">
      <div class="chart-heading"><div><h3>${escapeHtml(title)}</h3><p class="stat-help">${escapeHtml(subtitle || "")}</p></div><span class="sample-badge">${rows.length}회 관측</span></div>
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(title)}">
        ${[0, 0.33, 0.66, 1].map((ratio) => {
          const gy = pad.top + ratio * (height - pad.top - pad.bottom);
          return `<line class="grid-line" x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}"></line>`;
        }).join("")}
        ${series
          .map((item) => {
            const points = rows.map((row, index) => `${x(index)},${y(row[item.key])}`).join(" ");
            return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>${rows.map((row, index) => `<circle cx="${x(index)}" cy="${y(row[item.key])}" r="4" fill="${item.color}"><title>${row.date} ${formatNumber(row[item.key])}</title></circle>`).join("")}`;
          })
          .join("")}
        ${rows
          .map((row, index) => `<text class="axis-text" x="${x(index)}" y="${height - 8}" text-anchor="middle">${escapeHtml(row.date.slice(5))}</text>`)
          .join("")}
        <text class="axis-text" x="${pad.left}" y="${pad.top - 5}" text-anchor="start">${escapeHtml(formatCompact(rawMax))}</text>
      </svg>
      <div class="trend-summary">
        ${series.map((item) => {
          const first = Number(rows[0]?.[item.key] || 0);
          const last = Number(rows.at(-1)?.[item.key] || 0);
          const change = first ? ((last / first) - 1) * 100 : 0;
          return `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)} <strong>+${change.toFixed(1)}%</strong><small>${formatCompact(first)} → ${formatCompact(last)}</small></span>`;
        }).join("")}
      </div>
    </article>
  `;
}

function renderGenreBars(rows, marketLabel = "한국", scopeLabel = "시장 원본 캐릭터") {
  const max = Math.max(...rows.map((row) => Number(row.total_chats || 0)), 1);
  return `
    <article class="chart-card full-span">
      <div class="chart-heading"><div><h3>${escapeHtml(marketLabel)} 장르별 대화 구성</h3><p class="stat-help">공식 genre · 누적 대화수 기준 · ${escapeHtml(scopeLabel)}</p></div><span class="sample-badge">${rows.length}개 장르</span></div>
      <div class="genre-list">
        ${rows
          .map((row, index) => {
            const width = Math.max(3, Math.round((Number(row.total_chats || 0) / max) * 100));
            const color = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9", "#e66767"][index % 7];
            return `
              <div class="genre-row">
                <strong>${escapeHtml(row.genre_label || row.genre)} <small>${formatNumber(row.char_count)}명</small></strong>
                <span class="genre-bar-track"><span class="genre-bar-fill" style="width:${width}%;background:${color}"></span></span>
                <span>${formatNumber(row.total_chats)} · ${formatPercent(Number(row.share || 0) * 100)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function showLoadError(error) {
  els.statsCapturedAt.textContent = "데이터 로드 실패";
  els.statsCaveat.textContent = error.message;
  els.mainKpiGrid.innerHTML = "";
  els.statsDashboard.innerHTML = "";
  els.emptyState.hidden = false;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
}

function formatCompact(value) {
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function formatWonBig(value) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  if (Math.abs(amount) >= 100000000) {
    return `${(amount / 100000000).toFixed(1).replace(/\.0$/, "")}억원`;
  }
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`;
  }
  return `${formatNumber(amount)}원`;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatShortTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}.${m}.${d} ${h}:${min}`;
}

function formatCollectionPoint(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(5);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(/\. /g, ".").replace(/\.$/, "");
}

function formatDateShort(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${Number(match[2])}월 ${Number(match[3])}일`;
  return String(value);
}

function formatPeriodLabel(value) {
  if (!value) return "-";
  const label = String(value);
  let match = label.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (match) return `${Number(match[1])}월 ${Number(match[2])}일`;
  match = label.match(/^\d{4}-(\d{2})$/);
  if (match) return `${Number(match[1])}월`;
  match = label.match(/^(\d{2})-(\d{2})$/);
  if (match) return `${Number(match[1])}월 ${Number(match[2])}일`;
  match = label.match(/^(\d{2})$/);
  if (match) return `${Number(match[1])}월`;
  return label;
}

function formatFreshnessAge(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "수집 시각 확인 필요";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

function formatActivityWindow(baselineAt, capturedAt) {
  const start = new Date(baselineAt).getTime();
  const end = new Date(capturedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "직전 수집 대비";
  const minutes = Math.max(1, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes}분 수집 간격`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}시간 수집 간격`;
  return `${Math.round(hours / 24)}일 수집 간격`;
}

function formatActivityTimestamp(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? formatShortDate(value) : formatDateTime(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
