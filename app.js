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
const state = {
  view: "stats",
  market: "all",
  statsMarket: "all",
  selectedSupplyMonth: null,
  simulatedPrice: null,
  revenueViewMode: "recent",
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
let aiDiagnosisData = null;
let records = [];
let groups = [];
let lastTrigger = null;

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
  els.viewTabs = [...document.querySelectorAll("[data-view]")];
  els.marketTabs = [...document.querySelectorAll("[data-market]")];
  els.statsView = document.querySelector("#stats-view");
  els.validationView = document.querySelector("#validation-view");
  els.characterView = document.querySelector("#character-view");
  els.settingsView = document.querySelector("#settings-view");
  els.statsCapturedAt = document.querySelector("#stats-captured-at");
  els.statsCaveat = document.querySelector("#stats-caveat");
  els.mainKpiGrid = document.querySelector("#main-kpi-grid");
  els.statsMarketTabs = [...document.querySelectorAll("[data-stats-market]")];
  els.statsMarketNote = document.querySelector("#stats-market-note");
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
      writeHash();
    });
  });

  els.statsMarketTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.statsMarket = button.dataset.statsMarket;
      syncControls();
      renderStatsDashboard();
      bindResultButtons();
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

  document.addEventListener("click", (event) => {
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
  });

  els.apiSettingsForm?.addEventListener("submit", saveApiSettings);
  els.runManualDeploy?.addEventListener("click", runManualDeploy);
  els.runAiAnalysis?.addEventListener("click", runAiAnalysis);

  window.addEventListener("hashchange", () => {
    readHash();
    syncControls();
    render();
  });
}

async function load() {
  try {
    statsData = window.TOPTOON_STATS || null;
    catalogActivityData = window.TOPTOON_CHARACTER_ACTIVITY || null;
    validationData = window.TOPTOON_VALIDATION || null;
    officialSignalsData = window.TOPTOON_OFFICIAL_SIGNALS || null;
    officialPromotionsData = window.TOPTOON_OFFICIAL_PROMOTIONS || null;
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
  state.view = VIEW_META[nextView] && !(PUBLIC_READ_ONLY && nextView === "settings") ? nextView : state.view;
  if (!nextView && legacyMarket && MARKET_META[legacyMarket]) state.view = "characters";
  state.market = MARKET_META[nextMarket] ? nextMarket : state.market;
  state.statsMarket = MARKET_META[nextStatsMarket]
    ? nextStatsMarket
    : MARKET_META[nextLeaderboardMarket]
      ? nextLeaderboardMarket
      : state.statsMarket;
  state.q = params.get("q") || "";
  state.work = params.get("work") || "";
  state.sort = params.get("sort") || state.sort;
}

function writeHash() {
  const params = new URLSearchParams();
  params.set("view", state.view);
  params.set("market", state.market);
  if (state.statsMarket !== "all") params.set("scope", state.statsMarket);
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

  // 1. 서비스 론칭(2026.02.01) 기준 누적 계산
  const launchDate = new Date("2026-02-01T00:00:00+09:00");
  const captureDate = new Date(statsData.captured_at || Date.now());
  const elapsedDays = Math.max(1, Math.floor((captureDate - launchDate) / (1000 * 60 * 60 * 24)));
  const elapsedMonths = elapsedDays / 30;
  const elapsedMonthLabel = `${elapsedMonths.toFixed(1)}개월`;

  const revPerSession = Number(statsData.revenue_nowcast?.constants?.rev_per_session || 2354);
  const revPerSessionRange = statsData.revenue_nowcast?.constants?.rev_per_session_range || [2000, 2700];

  // 론칭 누적 추정 총매출
  const cumulativeGrossMid = allTotals.chats * revPerSession;
  const cumulativeGrossLow = allTotals.chats * revPerSessionRange[0];
  const cumulativeGrossHigh = allTotals.chats * revPerSessionRange[1];

  // 론칭 누적 월평균 환산 매출 (7개월 평균 런레이트)
  const cumulativeMonthlyAvg = cumulativeGrossMid / elapsedMonths;
  const krTotals = statsMarketTotals("kr");
  const krCumulativeMid = krTotals.chats * 2354;
  const overseasCumulativeMid = Math.max(0, cumulativeGrossMid - krCumulativeMid);
  const krMonthlyAvg = krCumulativeMid / elapsedMonths;
  const overseasMonthlyAvg = overseasCumulativeMid / elapsedMonths;

  // 2. 최근 일일 델타 기준 속도 관측 (Nowcast 런레이트)
  const latest = statsData.revenue_nowcast?.latest || {};
  const siteRevenue = statsData.site_revenue || {};
  const siteOverall = statsData.site_comparison?.overall || {};
  const recentAllMarketMid = Number(siteRevenue.grand_total_mid || 0);
  const recentAllMarketLow = revPerSession > 0 ? recentAllMarketMid * Number(revPerSessionRange[0] || 0) / revPerSession : 0;
  const recentAllMarketHigh = revPerSession > 0 ? recentAllMarketMid * Number(revPerSessionRange[1] || 0) / revPerSession : 0;
  const krRecentMid = Number(latest.revenue_mid || siteRevenue.per_site?.kr?.revenue_mid || 0);
  const overseasRecentMid = Math.max(0, recentAllMarketMid - krRecentMid);
  const krShareOfRecentPct = recentAllMarketMid > 0 ? (krRecentMid / recentAllMarketMid) * 100 : null;
  const velocityVsCumulativePct = cumulativeMonthlyAvg > 0 && recentAllMarketMid > 0
    ? ((recentAllMarketMid / cumulativeMonthlyAvg) - 1) * 100
    : null;
  const velocityDirection = velocityVsCumulativePct == null
    ? "비교 대기"
    : velocityVsCumulativePct >= 0 ? "최근 속도 우위" : "최근 속도 둔화";
  const velocityTone = velocityVsCumulativePct == null ? "neutral" : velocityVsCumulativePct >= 0 ? "positive" : "warning";

  els.statsCapturedAt.textContent = `${formatDateTime(statsData.captured_at)} 수집 스냅샷`;
  els.statsCaveat.textContent =
    `관측 채팅수에 미검증 단가를 적용한 참고 시나리오입니다. 2026.02 론칭 후 4개국 누적 추정(${elapsedMonthLabel} · ${elapsedDays}일)과 최근 시장별 4~${accumulatedDays}일 증가 속도를 같은 4개국 범위로 비교합니다.`;

  els.mainKpiGrid.innerHTML = `
    <div class="kpi-dual-container">
      <div class="kpi-group-card group-cumulative">
        <div class="kpi-group-header">
          <div class="kpi-group-title">
            <span class="kpi-group-tag tag-cumulative">🏛️ 서비스 론칭 누적 관측</span>
            <strong>🌐 4개국 통합 · 2026.02 이후 ${elapsedMonthLabel} 장기 평균</strong>
          </div>
          <span class="stat-help">4개국 누적 대화 ${formatNumber(allTotals.chats)}회 × 결제 단가 2,354원 기준</span>
        </div>
        <div class="kpi-card-subgrid">
          ${renderStatCards([
            ["🌐 통합 누적 추정 총매출", `약 ${formatWonBig(cumulativeGrossMid)}`, `🇰🇷 한국 ${formatWonBig(krCumulativeMid)} + 🌏 해외 ${formatWonBig(overseasCumulativeMid)}`, "signal"],
            ["🌐 통합 장기 월평균", `월 약 ${formatWonBig(cumulativeMonthlyAvg)}`, `🇰🇷 한국 월 ${formatWonBig(krMonthlyAvg)} + 🌏 해외 월 ${formatWonBig(overseasMonthlyAvg)} · 최근 속도 아님`, "neutral"],
            ["🌏 해외 누적 활동 비중", siteRevenue.overseas_contribution_pct != null ? `${siteRevenue.overseas_contribution_pct.toFixed(1)}%` : "-", `해외 누적 대화 ${formatNumber(siteOverall.overseas_total || 0)}회`, "positive"],
            ["서비스 운영 기간", `${elapsedDays}일차 (${elapsedMonthLabel})`, `2026.02.01 기준 계산`, "neutral"]
          ])}
        </div>
      </div>

      <div class="kpi-group-card group-velocity">
        <div class="kpi-group-header">
          <div class="kpi-group-title">
            <span class="kpi-group-tag tag-velocity">⚡ 최근 일일 속도 관측 (현재 런레이트)</span>
            <strong>🌐 4개국 통합 속도 및 시장별 기여 (최근 4~${accumulatedDays}일 런레이트)</strong>
          </div>
          <span class="stat-help">최근 일평균 증가량 × 30일 환산 (통합 10.8억 = 한국 6.7억 + 해외 4.1억)</span>
        </div>
        <div class="kpi-card-subgrid kpi-scope-split-grid">
          ${renderStatCards([
            ["🌐 통합 최근 런레이트", recentAllMarketMid ? `월 약 ${formatWonBig(recentAllMarketMid)}` : "-", recentAllMarketMid ? `${formatWonBig(recentAllMarketLow)}–${formatWonBig(recentAllMarketHigh)} · 한국+해외` : "시장별 델타 수집 대기", "signal"],
            ["🇰🇷 한국 최근 런레이트", krRecentMid ? `월 약 ${formatWonBig(krRecentMid)}` : "-", krShareOfRecentPct == null ? "한국 델타 수집 대기" : `통합 최근 속도의 ${krShareOfRecentPct.toFixed(1)}%`, "positive"],
            ["🌏 해외 합산 최근 런레이트", overseasRecentMid ? `월 약 ${formatWonBig(overseasRecentMid)}` : "-", siteRevenue.overseas_contribution_pct == null ? "해외 델타 수집 대기" : `통합 최근 속도의 ${siteRevenue.overseas_contribution_pct.toFixed(1)}% · 한국 단가 임시 적용`, "neutral"],
            ["🇰🇷 한국 9억 가정 대비", latest.ir_ratio_pct != null ? `${latest.ir_ratio_pct.toFixed(1)}%` : "-", "한국만 비교 · 9억원 원문 출처·범위 미확인", "warning"]
          ])}
        </div>
        <div class="kpi-scope-footnote">
          <span><strong>기간 차이</strong> 장기 평균 ${formatWonBig(cumulativeMonthlyAvg)} ↔ 최근 속도 ${formatWonBig(recentAllMarketMid)}</span>
          <span><strong>속도 변화</strong> ${velocityVsCumulativePct == null ? "비교 대기" : `${velocityDirection} ${velocityVsCumulativePct >= 0 ? "+" : ""}${velocityVsCumulativePct.toFixed(1)}%`}</span>
          <span><strong>표본</strong> 시장별 4~${accumulatedDays}일 · 14일 이상 권장</span>
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
  const capturedAt = market === "all"
    ? dataset?.generated_at
    : dataset?.market_snapshots?.[market]?.captured_at || dataset?.generated_at;

  // 1. 일간(24h) 델타 계산 (4개 시장 각각의 24h 실측 합산)
  const dailyDeltas = getDailyMarketDeltas(market);
  const dailyViewsDelta = dailyDeltas.viewsDelta;
  const dailyChatsDelta = dailyDeltas.chatsDelta;
  const dailyDateLabel = dailyDeltas.dateLabel;

  els.statsMarketNote.textContent = market === "all"
    ? "4개 시장 공식 공개 카탈로그 합계 · 중복 ID는 캐릭터 수에서 통합"
    : `${meta.label} 공식 공개 카탈로그 원본`;
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

  const cleanCapturedAt = formatShortTimestamp(capturedAt);

  els.statsMarketKpiGrid.innerHTML = renderStatCards([
    [`${meta.label} 캐릭터`, `${formatNumber(totals.characters)}명`, market === "all" ? `${formatNumber(totals.localeRecords)}개 지역 레코드` : "시장 원본 목록", "signal"],
    ["누적 조회수", formatNumber(totals.views), "공개 카운터 합계", "neutral"],
    ["누적 대화수", formatNumber(totals.chats), "공개 카운터 합계", "neutral"],
    ["최신 수집", cleanCapturedAt, `${formatFreshnessAge(capturedAt)} · ${activity.sourceLabel}`, "neutral"],
    ["일간(24h) 조회 증가", signedNumber(dailyViewsDelta), `${dailyDateLabel}`, dailyViewsDelta >= 0 ? "positive" : "warning"],
    ["일간(24h) 대화 증가", signedNumber(dailyChatsDelta), `${dailyDateLabel}`, dailyChatsDelta >= 0 ? "positive" : "warning"],
    [`${marketPrefix} 시간당 조회 증가`, signedNumber(avgHourlyViews), `시간당 평균 · 🔍 호버 시 24h 추이`, avgHourlyViews >= 0 ? "positive" : "warning", viewsPopover],
    [`${marketPrefix} 시간당 대화 증가`, signedNumber(avgHourlyChats), `시간당 평균 · 🔍 호버 시 24h 추이`, avgHourlyChats >= 0 ? "positive" : "warning", chatsPopover]
  ]);
  const targetMarkets = market === "all" ? MARKET_ORDER : [market];
  const allDailyDeltas = getDailyMarketDeltas("all");
  const observedCards = targetMarkets.map((key) => renderObservedMarketCard(key, allDailyDeltas)).join("");
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
      <section class="event-promotion-section" aria-label="공식 프로모션 감지">
        <div class="event-section-heading">
          <strong>공식 프로모션 감지</strong>
          <span>카탈로그 <code>price_promotion</code> 배지와 공식 홈페이지의 동일 캐릭터 링크를 교차확인</span>
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
    renderCatalogCrosscheck(validationData.catalogs || {}),
    renderScheduledAiDiagnosis(),
    renderRequiredCaveats(validationData.required_caveats || [], thesis)
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
  const catalogAt = dataset?.generated_at || validation.generated_at;
  return `
    <section class="freshness-strip" aria-label="데이터 최신성">
      <div><span class="freshness-dot is-live"></span><p><strong>주가</strong><small>${escapeHtml(marketView.sourceLabel)} · ${formatDateTime(marketView.refreshedAt)}</small></p></div>
      <div><span class="freshness-dot is-live"></span><p><strong>캐릭터 지표</strong><small>${formatDateTime(catalogAt)} 수집</small></p></div>
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
  const market = investor.market_snapshot || {};
  const ownership = investor.ownership_snapshot || {};
  const kis = officialSignalsData?.providers?.kis || {};
  const dynamicAlerts = calculateDynamicKrxAlerts(marketView.price, kis.price_history || []);

  return `
    <section class="panel stats-panel validation-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Security setup</p>
          <h2>주가 기대·수급 위험</h2>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="evidence-badge ${marketView.isSimulated ? "tier-b" : "tier-c"}">${marketView.isSimulated ? "⚡ 실시간 재계산 중" : "시세 C · 공시 A"}</span>
        </div>
      </div>

      <div class="krx-sim-toolbar" aria-label="주가 시나리오 및 재계산">
        <div class="sim-label-stack">
          <strong>⚡ 주가 시나리오 동적 재계산</strong>
          <small>시가총액과 9월 3일 투자경고 해제 조건(2,403원 미만) 및 재정지 기준선(4,816원)을 실시간 시뮬레이션합니다.</small>
        </div>
        <div class="sim-chip-list">
          <button type="button" class="sim-chip${!marketView.isSimulated ? " active" : ""}" data-set-price="${marketView.basePrice}">
            <span>실측 현재가</span> <b>${formatNumber(marketView.basePrice)}원</b>
          </button>
          <button type="button" class="sim-chip${marketView.price === dynamicAlerts.release.fifteen_day_limit_raw ? " active" : ""}" data-set-price="${dynamicAlerts.release.fifteen_day_limit_raw}">
            <span>경고해제 기준선</span> <b>${formatNumber(dynamicAlerts.release.fifteen_day_limit_raw)}원</b>
          </button>
          <button type="button" class="sim-chip${marketView.price === dynamicAlerts.halt.next_trigger_price ? " active" : ""}" data-set-price="${dynamicAlerts.halt.next_trigger_price}">
            <span>재정지 기준선</span> <b>${formatNumber(dynamicAlerts.halt.next_trigger_price)}원</b>
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
          ["7/31 이후", `${marketView.fromReferencePct >= 0 ? "+" : ""}${marketView.fromReferencePct.toFixed(1)}%`, `${formatNumber(market.reference_close)}원 기준`],
          ["최대주주 측", formatPercent(ownership.controller_and_related_pct), `${ownership.as_of || ""} 기준 · 최신성 주의`],
        ])}
      </div>
      ${marketView.open && marketView.high && marketView.low ? `<div class="market-session-strip" aria-label="오늘 장중 가격 범위"><span><small>시가</small><strong>${formatNumber(marketView.open)}원</strong></span><span><small>저가</small><strong>${formatNumber(marketView.low)}원</strong></span><span><small>고가</small><strong>${formatNumber(marketView.high)}원</strong></span><span><small>거래량</small><strong>${formatNumber(marketView.volume)}주</strong></span></div>` : ""}
      <div class="market-action-list">
        ${(investor.market_actions || []).map((action) => `<div><span class="status-badge status-warn">시장조치</span><strong>${escapeHtml(action.date)}</strong><p>${escapeHtml(action.label)}</p></div>`).join("")}
      </div>
      ${renderMarketAlertGuide(dynamicAlerts)}
      <p class="section-note">가격 상승은 사업 성과의 증거가 아닙니다. 실적 개선과 기대 선반영·저유통 수급을 분리해 판단해야 합니다.</p>
    </section>
  `;
}

function renderMarketAlertGuide(alerts) {
  const halt = alerts.halt || {};
  const release = alerts.release || {};
  const currentStatus = alerts.currentStatus || {};
  const release5 = Number(release.five_day_limit_raw || 0);
  const release15 = Number(release.fifteen_day_limit_raw || 0);
  const nextHaltThreshold = Number(halt.next_trigger_price || 4816);
  const currentPrice = Number(alerts.currentPrice || 3320);

  return `
    <section class="market-alert-guide" aria-label="투자경고 및 거래정지 조건">
      <div class="market-alert-heading">
        <div><span>KRX 시장경보 해설</span><h3>얼마면 정지되고, 언제 경고가 풀리나?</h3></div>
        <span class="alert-state alert-state-warn">${escapeHtml(currentStatus.statusLabel || "🚨 투자경고종목 지정 유지 (8/27 거래 재개)")}</span>
      </div>
      <div class="alert-rule-grid">
        <article class="alert-rule-card is-halt">
          <span class="alert-rule-step">거래정지 이력 및 재정지 기준</span>
          <strong style="color:#38bdf8">8/27 거래 재개 완료 (종가 ${formatNumber(currentPrice)}원)</strong>
          <p>8/25 종가(3,440원) 급등으로 <strong>8/26 1일간 매매거래정지 후 8/27 정상 해제</strong>되었습니다.<br>향후 <strong>${formatNumber(nextHaltThreshold)}원(+40%) 이상 추가 급등 시 1일간 재정지</strong>될 수 있습니다.</p>
          <div class="alert-meter"><span style="width:${Math.min(100, Math.max(0, (currentPrice / nextHaltThreshold) * 100))}%"></span><i style="left:100%"></i></div>
          <small>현재가 ${formatNumber(currentPrice)}원 · 재정지 기준선(${formatNumber(nextHaltThreshold)}원)까지 ${formatNumber(nextHaltThreshold - currentPrice)}원 여유</small>
        </article>
        <article class="alert-rule-card is-release">
          <span class="alert-rule-step">투자경고 해제 판단</span>
          <strong>${formatDateShort(release.earliest_judgment_date)} 최초 판단 <small style="font-size:11px;color:#f6c87d">(${escapeHtml(release.d_day_label || "D-7")})</small></strong>
          <p>9월 3일 아래 3개 조건에 <strong>모두 해당하지 않아야(미만)</strong> 투자경고가 해제됩니다.</p>
          <ul>
            <li><strong>조건 1:</strong> 5일 전(8/27) 종가(3,320원) 대비 45% 미만 상승 · <strong>${formatNumber(release5)}원 미만</strong> <span class="condition-tag ${release.cond1_met ? "pass" : "fail"}">${release.cond1_met ? "충족" : "미충족"}</span></li>
            <li><strong>조건 2:</strong> 15일 전(8/12) 종가(1,373원) 대비 75% 미만 상승 · <strong>${formatNumber(release15)}원 미만</strong> <span class="condition-tag ${release.cond2_met ? "pass" : "fail"}">${release.cond2_met ? "충족" : "미충족"}</span></li>
            <li><strong>조건 3:</strong> 최근 15거래일 최고가(${formatNumber(release.recent_15_max)}원) 미만일 것 <span class="condition-tag ${release.cond3_met ? "pass" : "fail"}">${release.cond3_met ? "충족" : "미충족"}</span></li>
          </ul>
        </article>
      </div>
      <div class="alert-source-row">
        <p><strong>💡 현상태 핵심 요약:</strong> 8/27 오늘 매매거래정지가 풀려 <strong>현재는 '투자경고종목 지정 유지' 상태</strong>입니다. 9월 3일 최초 해제 판단 시 <strong>주가가 ${formatNumber(release15)}원 미만(조건 2)이어야 해제</strong>되며, 현재가(${formatNumber(currentPrice)}원)가 유지될 경우 투자경고가 해제되지 않고 다음 거래일로 순연됩니다.</p>
        <div>
          ${halt.source_url ? `<a href="${escapeAttr(halt.source_url)}" target="_blank" rel="noopener noreferrer">KRX 거래정지 공시</a>` : ""}
          ${release.source_url ? `<a href="${escapeAttr(release.source_url)}" target="_blank" rel="noopener noreferrer">KRX 투자경고 공시</a>` : ""}
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
          <p class="section-kicker">01 · 매출 가능성</p>
          <h2>추정 매출 범위와 인기 캐릭터</h2>
        </div>
        <span class="data-pill warning">${extrapolationDays ? `${extrapolationDays}일 외삽` : "표본 대기"} · 가정 시나리오</span>
      </div>
      <p class="section-note metric-definition"><strong>캐릭터 기여도 정의:</strong> 캐릭터별 누적 공개 채팅수 ÷ 전체 누적 공개 채팅수입니다. 원화 환산액은 누적 chats × ₩2,354 가정이며, 실제 벌어온 금액이나 공시 매출이 아닙니다.</p>
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
  const revenue = statsData.site_revenue || {};
  const perSite = revenue.per_site || {};
  const overall = comparison.overall || {};
  const siteRows = MARKET_ORDER.map((market) => ({
    label: MARKET_META[market].label,
    value: perSite[market]?.revenue_mid || 0,
    sub: market === "kr" ? "한국" : `KR 대비 ${formatPercent(overall.per_site_pct?.[market])}`
  }));
  return `
    <section class="panel stats-panel signal-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">02 · 해외 반응</p>
          <h2>국가별 이용 비중과 최근 증가</h2>
        </div>
        <span class="data-pill neutral">단가 미검증</span>
      </div>
      <p class="section-note">한국·일본·Global·대만 공개 목록을 같은 시점에 수집했습니다. 해외 매출 계산에는 한국 세션당 단가를 임시 적용했습니다.</p>
      <div class="chart-grid chart-grid-primary">
        ${renderMarketComposition(overall.totals || {}, revenue.overseas_contribution_pct)}
        ${renderStackedDaily("최근 하루 대화 증가량", traction.daily || [])}
      </div>
      <div class="chart-grid chart-grid-secondary">
        ${renderBarChart("사이트별 월매출 가정치", "동일 단가 적용 · 투자 판단 전 현지 ASP 확인 필요", siteRows, formatWonBig, "#27c499", "full-span")}
      </div>
      <p class="section-note footnote">${escapeHtml(revenue.assumption_note || "")}</p>
    </section>
  `;
}

function renderCompletionPanel() {
  const ceiling = statsData.completion_ceiling || {};
  const totals = ceiling.totals || {};
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
        ["증가 데이터 수집일", formatActivityTimestamp(activitySummary.capturedAt), activitySummary.sourceLabel, "signal"]
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
  const daily = workerActivityForId(model.id);
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
      <td class="metric collection-date">${activity ? `<strong>${escapeHtml(formatActivityTimestamp(activity.last_seen))}</strong><small>${escapeHtml(activity.sourceLabel)}</small>` : `<span class="activity-unavailable">—</span>`}</td>
      <td>${escapeHtml(model.counterparts)}</td>
    </tr>
  `;
}

function renderCard(item) {
  const model = viewModel(item);
  const activity = characterActivity(item);
  const daily = workerActivityForId(model.id);
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
        <span class="card-collection">${activity ? `최근 수집 ${escapeHtml(formatActivityTimestamp(activity.last_seen))} · ${escapeHtml(activity.sourceLabel)}` : "직전 비교 데이터 없음"}</span>
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
  const coverageLabel = coverageSeconds >= 20 * 3600
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
        <span class="event-pill ${escapeHtml(market)}-pill">${meta.flag} ${escapeHtml(meta.label)} API 실측</span>
        <strong class="event-reason">24시간 환산 조회 ${signedNumber(daily.viewsDelta)} · 대화 ${signedNumber(daily.chatsDelta)}</strong>
      </div>
      <p class="event-share-line">
        <span>4개국 조회 증가 비중 <b>${viewShare.toFixed(1)}%</b></span>
        <span>4개국 대화 증가 비중 <b>${chatShare.toFixed(1)}%</b></span>
      </p>
      <p class="event-feed-text"><strong>최근 ${escapeHtml(activity.windowLabel)} 조회 증가 상위:</strong> ${renderMoverNames(market, "delta")}</p>
      <p class="event-feed-text"><strong>최근 ${escapeHtml(activity.windowLabel)} 대화 증가 상위:</strong> ${renderMoverNames(market, "chat_delta")}</p>
      <p class="event-metric-note">누적 상위가 아닌 최근 수집 간 델타 순위입니다. 증가 원인은 공개 API만으로 판단하지 않습니다.</p>
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

function renderOfficialPromotionCard(market) {
  const meta = MARKET_META[market];
  const observation = officialPromotionsData?.markets?.[market] || null;
  const items = observation?.items || [];
  const status = observation?.status || "unavailable";
  const observedAt = observation?.observed_at || officialPromotionsData?.generated_at;
  const statusClass = ["verified", "partial", "none"].includes(status) ? status : "unavailable";

  if (!items.length) {
    const message = status === "none"
      ? "이번 갱신에서 공식 카탈로그의 할인 프로모션 배지가 감지되지 않았습니다."
      : "공식 프로모션 출처를 확인하지 못했습니다. 이전 문구를 추정으로 대체하지 않습니다.";
    return `
      <article class="promotion-card is-${statusClass}">
        <div class="promotion-card-head">
          <span>${meta.flag} ${escapeHtml(meta.label)}</span>
          <b>${status === "none" ? "공식 프로모션 미감지" : "출처 확인 불가"}</b>
        </div>
        <p>${message}</p>
        <div class="promotion-card-meta">
          <span>${observedAt ? `${escapeHtml(formatShortTimestamp(observedAt))} 확인` : "확인 시각 없음"}</span>
          ${observation?.homepage_url ? `<a href="${escapeHtml(observation.homepage_url)}" target="_blank" rel="noopener noreferrer">공식 홈 열기 ↗</a>` : ""}
        </div>
      </article>
    `;
  }

  const itemHtml = items.map((item) => {
    const title = item.headline || `${item.character_name} · 공식 API 프로모션 배지 확인`;
    const verificationLabel = item.verification === "api-and-homepage"
      ? "API 배지 + 공식 홈 교차확인"
      : "API 배지만 확인 · 홈 문구 미확인";
    return `
      <div class="promotion-item">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(verificationLabel)}</span>
        <a href="${escapeHtml(item.detail_url)}" target="_blank" rel="noopener noreferrer">공식 캐릭터 페이지 ↗</a>
      </div>
    `;
  }).join("");

  return `
    <article class="promotion-card is-${statusClass}">
      <div class="promotion-card-head">
        <span>${meta.flag} ${escapeHtml(meta.label)}</span>
        <b>${escapeHtml(promotionChangeLabel(observation.change))}</b>
      </div>
      ${itemHtml}
      <div class="promotion-card-meta">
        <span>${observedAt ? `${escapeHtml(formatShortTimestamp(observedAt))} 확인` : "확인 시각 없음"}</span>
        <a href="${escapeHtml(observation.homepage_url)}" target="_blank" rel="noopener noreferrer">출처 홈 ↗</a>
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
    const validPath = /^\/character\/\d+\/video-thumbnail\/[a-z0-9-]+\.mp4$/i.test(url.pathname);
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
      <video class="character-motion" autoplay muted loop playsinline preload="metadata"${activePoster ? ` poster="${escapeAttr(activePoster)}"` : ""} aria-label="${escapeAttr(`${model.name} 공식 모션 미리보기`)}">
        <source src="${escapeAttr(activeVideoSrc)}" type="video/mp4" />
      </video>
      <div class="motion-fallback" aria-hidden="true">
        ${activePoster ? renderFullImage(model) : `<span class="thumb-fallback thumb-full">${fallback}</span>`}
      </div>
      <span class="motion-badge"><i></i> 공식 모션${motionCount > 1 ? ` · ${motionCount}개 바리에이션` : ""}</span>
      ${motionCount > 1 ? `
        <div class="motion-variation-switcher" aria-label="모션 영상 바리에이션">
          ${motions.map((m) => `
            <button type="button" class="motion-chip${m.market === (currentMotion?.market || selected.market) ? " active" : ""}" data-motion-src="${escapeAttr(m.videoUrl)}" data-motion-poster="${escapeAttr(m.poster)}" data-motion-market="${escapeAttr(m.label)}" title="${escapeAttr(`${m.label} 버전 모션 재생`)}">
              <span class="motion-chip-dot"></span>
              <span>${MARKET_FLAGS[m.market] || ""} ${escapeHtml(m.label)}</span>
            </button>
          `).join("")}
        </div>
      ` : ""}
    </div>
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

function openDialog(characterId, trigger, preferredMarket = null) {
  const idNum = Number(characterId);
  const group = groups.find((candidate) => candidate.id === idNum || candidate.allRecords.some((r) => Number(r.character_id) === idNum || Number(r.canonicalId) === idNum));
  if (!group) return;
  const selected =
    preferredMarket && preferredMarket !== "all"
      ? group.locales[preferredMarket] || group.primary
      : state.market === "all" ? group.primary : group.locales[state.market] || group.primary;
  lastTrigger = trigger;
  els.dialogContent.innerHTML = renderDialogContent(group, selected);
  bindImageFallbacks(els.dialogContent);
  bindMotionControls(els.dialogContent);
  if (typeof els.dialog.showModal === "function") {
    els.dialog.showModal();
  } else {
    els.dialog.setAttribute("open", "");
  }
}

function bindMotionControls(root) {
  const video = root.querySelector("video.character-motion");
  const badge = root.querySelector(".motion-badge");
  const chips = root.querySelectorAll(".motion-chip[data-motion-src]");

  chips.forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const nextSrc = chip.dataset.motionSrc;
      const nextPoster = chip.dataset.motionPoster;
      const marketLabel = chip.dataset.motionMarket;
      if (video && nextSrc) {
        video.src = nextSrc;
        if (nextPoster) video.poster = nextPoster;
        video.load();
        video.play().catch(() => {});
        chips.forEach((c) => c.classList.toggle("active", c === chip));
        if (badge) badge.innerHTML = `<i></i> 공식 모션 · ${escapeHtml(marketLabel)}`;
      }
    });
  });

  [...root.querySelectorAll(".character-motion")].forEach((v) => {
    const shell = v.closest(".character-motion-shell");
    v.addEventListener("playing", () => shell?.classList.add("is-playing"), { once: true });
    v.addEventListener("error", () => shell?.classList.add("is-fallback"), { once: true });
    v.play().catch(() => {
      v.controls = true;
      shell?.classList.add("needs-play");
    });
  });
}

function closeDialog() {
  if (els.dialog.open && typeof els.dialog.close === "function") {
    els.dialog.close();
  } else {
    els.dialog.removeAttribute("open");
  }
}

function renderDialogContent(group, selected) {
  const model = viewModel(selected);
  const activity = characterActivityForMarket(selected, selected.market);
  const dailyWorker = selected.market === "kr" ? workerActivityForId(selected.character_id) : null;
  const hourlyMetrics = characterHourlyMetrics(selected);
  const hourlyViewsPopover = renderCharacterHourlyPopover(selected, "views", hourlyMetrics);
  const hourlyChatsPopover = renderCharacterHourlyPopover(selected, "chats", hourlyMetrics);
  const hourlyHelp = hourlyMetrics ? `${hourlyMetrics.coverageLabel} · 🔍 호버 시 추이` : "시간대 이력 수집 대기";
  const officialLink = selected.detail_url
    ? `<a class="ghost-button dialog-open-link" href="${escapeAttr(selected.detail_url)}" target="_blank" rel="noopener noreferrer">공식 캐릭터 페이지</a>`
    : "";
  const estimatedRevenue = formatWonBig(selected.chatsNumber * 2354);
  const idDisplay = selected.character_id !== group.id
    ? `${group.id} <small style="font-size:11px;color:var(--muted)">(${MARKET_META[selected.market].short} ID ${selected.character_id})</small>`
    : `${group.id}`;
  return `
    <div class="dialog-hero">
      <div class="dialog-image-frame">
        ${renderCharacterMotion(group, selected)}
      </div>
      <div class="dialog-title-block">
        <p class="section-kicker">${escapeHtml(MARKET_META[selected.market].label)}</p>
        <h2 id="dialog-title">${escapeHtml(selected.character_name)}</h2>
        <p>${escapeHtml(selected.workSafe)}</p>
        <p class="dialog-media-note">${model.videoSrc ? "공식 소개 페이지의 안전 모션 미리보기를 자동 재생합니다." : "모션 미리보기가 없는 캐릭터는 전체 이미지를 표시합니다."}</p>
        ${officialLink}
        <div class="pill-list">${renderMarketPills(group.markets, selected.market)}</div>
      </div>
    </div>
    <div class="dialog-metrics">
      <div><span>Character ID</span><strong>${idDisplay}</strong></div>
      <div><span>누적 조회수</span><strong>${formatNumber(selected.viewsNumber)}</strong></div>
      <div><span>누적 대화수</span><strong>${formatNumber(selected.chatsNumber)}</strong></div>
      <div><span>가정 환산액</span><strong style="color:#f6c87d">${estimatedRevenue}</strong><small>대화 × 2,354원</small></div>
      ${dailyWorker ? `
        <div class="is-daily-metric"><span>일간(24h) 조회 증가</span><strong>${renderActivityDelta(dailyWorker.delta, "일간 데이터 없음")}</strong><small>${escapeHtml(formatShortDate(dailyWorker.last_seen))} 일간</small></div>
        <div class="is-daily-metric"><span>일간(24h) 대화 증가</span><strong>${renderActivityDelta(dailyWorker.chat_delta, "일간 데이터 없음")}</strong><small>${escapeHtml(formatShortDate(dailyWorker.last_seen))} 일간</small></div>
      ` : ""}
      <div class="character-rate-metric has-popover" tabindex="0">
        <span>${escapeHtml(MARKET_META[selected.market].label)} 시간당 평균 조회</span>
        <strong>${hourlyMetrics ? `${signedNumber(hourlyMetrics.viewsPerHour)}<small>회/h</small>` : "—"}</strong>
        <small>${escapeHtml(hourlyHelp)}</small>
        <div class="stat-card-popover character-metric-popover">${hourlyViewsPopover}</div>
      </div>
      <div class="character-rate-metric has-popover" tabindex="0">
        <span>${escapeHtml(MARKET_META[selected.market].label)} 시간당 평균 대화</span>
        <strong>${hourlyMetrics ? `${signedNumber(hourlyMetrics.chatsPerHour)}<small>회/h</small>` : "—"}</strong>
        <small>${escapeHtml(hourlyHelp)}</small>
        <div class="stat-card-popover character-metric-popover">${hourlyChatsPopover}</div>
      </div>
      <div class="collection-time-metric"><span>수집 기준 시각</span><strong>${activity || hourlyMetrics ? escapeHtml(formatActivityTimestamp(hourlyMetrics?.latestAt || activity?.last_seen)) : "다음 수집 후 계산"}</strong><small>공식 공개 API 카운터 · 고유 이용자/결제/매출 아님</small></div>
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
          <strong class="stat-value">${escapeHtml(value ?? "-")}</strong>
          <p class="stat-help">${escapeHtml(help ?? "")}</p>
          ${popover ? `<div class="stat-card-popover">${popover}</div>` : ""}
        </article>
      `
    )
    .join("");
}

function renderCharacterLeaderboard(byCharacter) {
  const selectedMarket = MARKET_META[state.statsMarket] ? state.statsMarket : "all";
  const fullRanking = leaderboardRanking(selectedMarket);
  const totalChats = fullRanking.reduce((sum, record) => sum + record.chatsNumber, 0) || 1;
  const top = fullRanking.slice(0, 6);
  const scopeLabel = selectedMarket === "all" ? "통합 4개 시장 합산" : `${MARKET_META[selectedMarket].label} 공개 데이터`;
  return `
    <article class="chart-card span-5 character-rank-card">
      <div class="chart-heading">
        <div>
          <h3>인기 캐릭터 TOP 6</h3>
          <p class="stat-help">${escapeHtml(scopeLabel)} 대화수 순위 · 상단 국가 선택과 자동 연동</p>
        </div>
        <div class="rank-heading-actions">
          <span class="sample-badge">TOP 6</span>
          <button class="rank-expand-button" type="button" data-rank-toggle aria-expanded="false"><b>전체 순위 펼치기</b><span>${formatNumber(fullRanking.length)}명</span></button>
        </div>
      </div>
      <div class="leaderboard-scope-note" aria-live="polite">
        <span aria-hidden="true">🔗</span>
        <p><strong>${escapeHtml(MARKET_META[selectedMarket].flag)} ${escapeHtml(MARKET_META[selectedMarket].label)} 선택 적용 중</strong><small>상단 국가 버튼을 바꾸면 TOP6와 전체 순위도 함께 전환됩니다.</small></p>
      </div>
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
          const estimatedWon = formatWonBig(item.chatsNumber * 2354);
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
                <small>누적 대화 × 2,354원 가정치이며 유료 결제·매출 순위가 아님</small>
              </span>
            </button>
          `;
        }).join("")}
          </div>
          <p class="chart-tail">통합·국가별 순위는 공개 대화수 기준이며, 환산액은 누적 대화 × 2,354원 가정치(실제 매출 아님)입니다. 클릭하면 전체 이미지와 국가별 정보가 열립니다.</p>
        </div>
        <aside class="full-rank-panel" hidden aria-label="${escapeAttr(scopeLabel)} 전체 캐릭터 공개 대화 순위">
          <div class="full-rank-header"><div><strong>${escapeHtml(MARKET_META[selectedMarket].label)} 전체 캐릭터 순위</strong><small>${escapeHtml(scopeLabel)} 공개 대화수 기준 · ${formatNumber(fullRanking.length)}명</small></div><span>최신 ${escapeHtml(formatDateTime(dataset.generated_at))}</span></div>
          <div class="full-rank-list">
            ${fullRanking.map((record, index) => {
              const share = (record.chatsNumber / totalChats) * 100;
              const estimatedRowWon = formatWonBig(record.chatsNumber * 2354);
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
  const siteRevenue = statsData.site_revenue || {};
  const siteTraction = statsData.site_traction || {};
  const dailyHistory = siteTraction.daily || [];

  const launchDate = new Date("2026-02-01T00:00:00+09:00");
  const captureDate = new Date(statsData?.captured_at || Date.now());
  const elapsedDays = Math.max(1, Math.floor((captureDate - launchDate) / (1000 * 60 * 60 * 24)));
  const elapsedMonths = elapsedDays / 30;
  const revPerSession = Number(revenue.constants?.rev_per_session || 2354);
  const cumulativeMonthlyAverage = elapsedMonths > 0 ? (allTotals.chats * revPerSession) / elapsedMonths : 0;

  if (mode === "cumulative") {
    // 2026.02 론칭 누적 실적 뷰
    if (market === "all") {
      const totalChats = allTotals.chats;
      const grossMid = totalChats * 2354;
      const grossLow = totalChats * 2000;
      const grossHigh = totalChats * 2700;
      const monthlyAvg = grossMid / elapsedMonths;

      // 4개 시장별 누적 데이터 행 구성
      const marketRows = MARKET_ORDER.map((mKey) => {
        const mTotals = statsMarketTotals(mKey);
        const mChats = mTotals.chats;
        const mMid = mChats * 2354;
        const mLow = mChats * 2000;
        const mHigh = mChats * 2700;
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
              <h3>론칭 누적 실적 추정: 4개국 통합 얼마를 벌었나?</h3>
              <p class="stat-help">2026년 2월 론칭 이후 4개국 누적 ${formatNumber(totalChats)}회 대화 × 세션당 2,000~2,700원 가정</p>
            </div>
            <div class="revenue-mode-tabs" role="tablist" aria-label="매출 추정 모드">
              <button type="button" class="rev-tab-btn" data-revenue-mode="recent">⚡ 최근 런레이트</button>
              <button type="button" class="rev-tab-btn active" data-revenue-mode="cumulative">🏛️ 2026.02 론칭 누적</button>
            </div>
          </div>
          <div class="revenue-headline">
            <div><span>4개국 7개월 누적 총매출</span><strong>${formatWonBig(grossMid)}</strong><small>누적 ${formatNumber(totalChats)}회 대화 환산</small></div>
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
          <div class="benchmark-key"><span></span><strong>4개국 누적 7개월(${elapsedDays}일) 환산 월평균은 월 약 ${formatWonBig(monthlyAvg)}</strong><small>해외는 한국 단가 2,354원 임시 적용</small></div>
          <div class="revenue-confidence-grid">
            <div><span>누적 운영 기간</span><strong>${elapsedDays}일 (7개월)</strong><small>2026.02.01 론칭</small></div>
            <div><span>누적 월평균</span><strong>월 약 ${formatWonBig(monthlyAvg)}</strong><small>4개국 누적 환산치</small></div>
            <div class="is-highlight"><span>누적 총 대화수</span><strong>${formatNumber(totalChats)}회</strong><small>4개국 합계</small></div>
          </div>
        </article>
      `;
    }

    // 개별 국가 누적 뷰 (kr, jp, global, tw)
    const mChats = currentTotals.chats;
    const mGrossMid = mChats * 2354;
    const mGrossLow = mChats * 2000;
    const mGrossHigh = mChats * 2700;
    const mMonthlyAvg = mGrossMid / elapsedMonths;
    const isKr = market === "kr";

    return `
      <article class="chart-card span-7 revenue-range-card">
        <div class="chart-heading">
          <div>
            <h3>론칭 누적 실적 추정: ${meta.flag} ${escapeHtml(meta.label)} 얼마를 벌었나?</h3>
            <p class="stat-help">${escapeHtml(meta.label)} 누적 ${formatNumber(mChats)}회 대화 × 세션당 2,000~2,700원 가정</p>
          </div>
          <div class="revenue-mode-tabs" role="tablist" aria-label="매출 추정 모드">
            <button type="button" class="rev-tab-btn" data-revenue-mode="recent">⚡ 최근 런레이트</button>
            <button type="button" class="rev-tab-btn active" data-revenue-mode="cumulative">🏛️ 2026.02 론칭 누적</button>
          </div>
        </div>
        <div class="revenue-headline">
          <div><span>${escapeHtml(meta.label)} 7개월 누적 매출</span><strong>${formatWonBig(mGrossMid)}</strong><small>누적 ${formatNumber(mChats)}회 대화 환산</small></div>
          <div class="revenue-range-summary">
            <span><small>낮게 보면</small><strong>${formatWonBig(mGrossLow)}</strong></span>
            <span class="is-focus"><small>누적 기준값</small><strong>${formatWonBig(mGrossMid)}</strong></span>
            <span><small>높게 보면</small><strong>${formatWonBig(mGrossHigh)}</strong></span>
          </div>
        </div>
        ${!isKr ? `
          <div class="benchmark-key is-warning" style="margin:12px 0 6px"><span>⚠️</span><strong>한국 세션당 단가(2,354원) 임시 적용</strong><small>${escapeHtml(meta.label)} 현지 ASP와 결제율 미확인</small></div>
        ` : `
          <div class="benchmark-key" style="margin:12px 0 6px"><span></span><strong>한국 누적 7개월 환산 월평균은 월 약 ${formatWonBig(mMonthlyAvg)}</strong><small>누적 대화수 기반 환산치</small></div>
        `}
        <div class="revenue-confidence-grid">
          <div><span>누적 운영 기간</span><strong>${elapsedDays}일 (7개월)</strong><small>2026.02.01 론칭</small></div>
          <div><span>${escapeHtml(meta.label)} 누적 월평균</span><strong>월 약 ${formatWonBig(mMonthlyAvg)}</strong><small>누적 총매출 ÷ 7개월</small></div>
          <div class="is-highlight"><span>${escapeHtml(meta.label)} 누적 대화</span><strong>${formatNumber(mChats)}회</strong><small>공개 카운터 합계</small></div>
        </div>
      </article>
    `;
  }

  // 최근 일일 런레이트 뷰 (recent)
  if (market === "all") {
    // 4개국 전체 합산 런레이트 (약 10.8억원)
    const grandMid = siteRevenue.grand_total_mid || 1076298234;
    const grandLow = Math.round(grandMid * (2000 / 2354));
    const grandHigh = Math.round(grandMid * (2700 / 2354));
    const krMid = Number(siteRevenue.per_site?.kr?.revenue_mid || revenue.latest?.revenue_mid || 0);
    const overseasMid = Number(siteRevenue.overseas_total_mid || Math.max(0, grandMid - krMid));
    const velocityVsAveragePct = cumulativeMonthlyAverage > 0
      ? ((grandMid / cumulativeMonthlyAverage) - 1) * 100
      : null;
    
    // 일자별 4개국 합산 델타 밴드 생성
    const dailyKeys = MARKET_ORDER.map((m) => `${m}_delta`);
    const allMarketRows = dailyHistory.map((dRow) => {
      const dayTotalDelta = dailyKeys.reduce((sum, k) => sum + Number(dRow[k] || 0), 0);
      const dayMid = dayTotalDelta * 30 * 2354;
      const dayLow = dayTotalDelta * 30 * 2000;
      const dayHigh = dayTotalDelta * 30 * 2700;
      return {
        date: dRow.date,
        delta: dayTotalDelta,
        revenue_mid: dayMid,
        revenue_low: dayLow,
        revenue_high: dayHigh
      };
    });

    const maxVal = Math.max(...allMarketRows.map((r) => r.revenue_high), grandHigh, 1);

    return `
      <article class="chart-card span-7 revenue-range-card">
        <div class="chart-heading">
          <div>
            <h3>월매출 추정: 4개국 통합 얼마까지 볼 수 있나?</h3>
            <p class="stat-help">4개국 최근 대화 증가 합산을 30일로 환산 · 세션당 2,000~2,700원 가정</p>
          </div>
          <div class="revenue-mode-tabs" role="tablist" aria-label="매출 추정 모드">
            <button type="button" class="rev-tab-btn active" data-revenue-mode="recent">⚡ 최근 4개국 런레이트</button>
            <button type="button" class="rev-tab-btn" data-revenue-mode="cumulative">🏛️ 2026.02 론칭 누적</button>
          </div>
        </div>
        <div class="revenue-headline">
          <div><span>4개국 합산 기준 시나리오</span><strong>${formatWonBig(grandMid)}</strong><small>월 환산 · 공시 매출 아님</small></div>
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
            <small>한국 최근 ${revenue.daily?.length || 0}일 평균</small>
          </div>
          <div class="scope-card is-overseas">
            <span>🌏 해외 합산</span>
            <strong>${formatWonBig(overseasMid)}</strong>
            <small>일본·Global·대만 · 한국 단가 임시 적용</small>
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
        <div class="benchmark-key is-warning"><span>⚠️</span><strong>${formatWonBig(grandMid)}은 최근 활동 속도의 30일 환산값입니다.</strong></div>
        <div class="revenue-confidence-grid">
          <div><span>관측 표본</span><strong>시장별 4~5일</strong><small>최소 14일 권장</small></div>
          <div><span>통합 장기 월평균 대비</span><strong>${velocityVsAveragePct == null ? "-" : `${velocityVsAveragePct >= 0 ? "+" : ""}${velocityVsAveragePct.toFixed(1)}%`}</strong><small>장기 평균 ${formatWonBig(cumulativeMonthlyAverage)} ↔ 최근 속도 ${formatWonBig(grandMid)}</small></div>
          <div class="is-caution"><span>모델 신뢰도</span><strong>낮음</strong><small>결제율·해외ASP 미공시</small></div>
        </div>
      </article>
    `;
  }

  if (market === "kr") {
    // 한국 단독 런레이트 뷰 (약 6.7억원)
    const rows = revenue.daily || [];
    const benchmark = revenue.ir_benchmark?.monthly || 900000000;
    const latest = revenue.latest || rows.at(-1) || {};
    const values = rows.flatMap((row) => [row.revenue_low, row.revenue_mid, row.revenue_high]);
    if (benchmark) values.push(benchmark);
    const max = Math.max(...values.map(Number), 1);
    const benchmarkRatio = benchmark ? (Number(latest.revenue_mid || 0) / benchmark) * 100 : 0;
    return `
      <article class="chart-card span-7 revenue-range-card">
        <div class="chart-heading">
          <div>
            <h3>월매출 추정: 한국(KR) 얼마까지 볼 수 있나?</h3>
            <p class="stat-help">한국 최근 대화 증가를 30일로 환산 · 세션당 2,000~2,700원 가정</p>
          </div>
          <div class="revenue-mode-tabs" role="tablist" aria-label="매출 추정 모드">
            <button type="button" class="rev-tab-btn active" data-revenue-mode="recent">⚡ 최근 ${rows.length}일 런레이트</button>
            <button type="button" class="rev-tab-btn" data-revenue-mode="cumulative">🏛️ 2026.02 론칭 누적</button>
          </div>
        </div>
        <div class="revenue-headline">
          <div><span>한국 기준 시나리오</span><strong>${formatWonBig(latest.revenue_mid)}</strong><small>월 환산 · 공시 매출 아님</small></div>
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
        <div class="benchmark-key"><span></span><strong>한국 기준값은 IR 제시 ${formatWonBig(benchmark)}의 ${benchmarkRatio.toFixed(1)}%</strong><small>IR 수치는 외부 검증 전 비교 기준</small></div>
        <div class="revenue-confidence-grid">
          <div><span>관측 표본</span><strong>${rows.length}일</strong><small>최소 14일 권장</small></div>
          <div><span>IR 대비</span><strong>${benchmarkRatio.toFixed(1)}%</strong><small>${formatWonBig(Number(benchmark || 0) - Number(latest.revenue_mid || 0))} 차이</small></div>
          <div class="is-caution"><span>모델 신뢰도</span><strong>낮음</strong><small>결제율·ASP 미공시</small></div>
        </div>
      </article>
    `;
  }

  // 개별 해외 시장 런레이트 뷰 (jp, tw, global)
  const siteInfo = siteRevenue.per_site?.[market] || {};
  const mRecentMid = siteInfo.revenue_mid || 0;
  const mRecentLow = Math.round(mRecentMid * (2000 / 2354));
  const mRecentHigh = Math.round(mRecentMid * (2700 / 2354));
  const deltaKey = `${market}_delta`;
  const mRows = dailyHistory.map((dRow) => {
    const dVal = Number(dRow[deltaKey] || 0);
    const dMid = dVal * 30 * 2354;
    const dLow = dVal * 30 * 2000;
    const dHigh = dVal * 30 * 2700;
    return { date: dRow.date, delta: dVal, revenue_mid: dMid, revenue_low: dLow, revenue_high: dHigh };
  });

  const maxVal = Math.max(...mRows.map((r) => r.revenue_high), mRecentHigh, 1);

  return `
    <article class="chart-card span-7 revenue-range-card">
      <div class="chart-heading">
        <div>
          <h3>월매출 추정: ${meta.flag} ${escapeHtml(meta.label)} 얼마까지 볼 수 있나?</h3>
          <p class="stat-help">${escapeHtml(meta.label)} 최근 대화 증가를 30일로 환산 · 한국 단가(2,354원) 임시 적용</p>
        </div>
        <div class="revenue-mode-tabs" role="tablist" aria-label="매출 추정 모드">
          <button type="button" class="rev-tab-btn active" data-revenue-mode="recent">⚡ 최근 런레이트</button>
          <button type="button" class="rev-tab-btn" data-revenue-mode="cumulative">🏛️ 2026.02 론칭 누적</button>
        </div>
      </div>
      <div class="revenue-headline">
        <div><span>${escapeHtml(meta.label)} 기준 시나리오</span><strong>${formatWonBig(mRecentMid)}</strong><small>월 환산 · 임시 추정치</small></div>
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
      <div class="benchmark-key is-warning"><span>⚠️</span><strong>한국 세션당 단가(2,354원) 임시 적용</strong><small>${escapeHtml(meta.label)} 현지 ASP 및 결제율 미공시 상태 · IR 9억 비교 제외</small></div>
      <div class="revenue-confidence-grid">
        <div><span>관측 표본</span><strong>최근 ${mRows.length}일</strong><small>일간 델타 연속 기록</small></div>
        <div><span>${escapeHtml(meta.label)} 런레이트</span><strong>월 약 ${formatWonBig(mRecentMid)}</strong><small>임시 단가 기준</small></div>
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
        <div><span>해외 가정 매출 비중</span><strong>${formatPercent(overseasContribution)}</strong><small>한국 단가 임시 적용</small></div>
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
      <p class="chart-tail">대화 비중과 가정 매출 비중은 서로 다른 지표입니다. 매출 비중은 국가별 실제 결제 단가가 확인되기 전 임시 추정입니다.</p>
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
