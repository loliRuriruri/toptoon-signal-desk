const MARKET_META = {
  all: { label: "통합", short: "통합" },
  kr: { label: "한국", short: "KR", site: "KR", locale: "ko-KR", color: "#3987e5" },
  jp: { label: "日本", short: "JP", site: "JP", locale: "ja", color: "#d95926" },
  global: { label: "Global", short: "Global", site: "GLOBAL", locale: "en", color: "#199e70" },
  tw: { label: "台灣", short: "TW", site: "TW", locale: "zh-TW", color: "#22b8a7" }
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
  q: "",
  work: "",
  sort: "views-desc"
};

const els = {};
let dataset = null;
let statsData = null;
let validationData = null;
let integrationsData = null;
let officialSignalsData = null;
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
  els.statsDashboard = document.querySelector("#stats-dashboard");
  els.validationCapturedAt = document.querySelector("#validation-captured-at");
  els.validationCaveat = document.querySelector("#validation-caveat");
  els.validationKpiGrid = document.querySelector("#validation-kpi-grid");
  els.validationDashboard = document.querySelector("#validation-dashboard");
  els.validationDetail = document.querySelector("#validation-detail");
  els.activeMarketLabel = document.querySelector("#active-market-label");
  els.catalogKpiGrid = document.querySelector("#catalog-kpi-grid");
  els.searchInput = document.querySelector("#search-input");
  els.workFilter = document.querySelector("#work-filter");
  els.sortSelect = document.querySelector("#sort-select");
  els.tbody = document.querySelector("#character-tbody");
  els.cardList = document.querySelector("#card-list");
  els.resultStatus = document.querySelector("#result-status");
  els.emptyState = document.querySelector("#empty-state");
  els.resetFilters = document.querySelector("#reset-filters");
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

  els.resetFilters.addEventListener("click", () => {
    state.q = "";
    state.work = "";
    state.sort = "views-desc";
    syncControls();
    renderCharacterView();
    writeHash();
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
    validationData = window.TOPTOON_VALIDATION || null;
    officialSignalsData = window.TOPTOON_OFFICIAL_SIGNALS || null;
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

function normalizeRecord(record) {
  const market = MARKET_BY_SITE[record.site] || "global";
  const filename = String(record.local_image || "").split("/").pop();
  const imageKey = filename ? `${market}/${filename}` : "";
  return {
    ...record,
    market,
    viewsNumber: Number(record.views || 0),
    chatsNumber: Number(record.chats || 0),
    workSafe: record.work_title || MISSING_WORK,
    imageSrc: filename ? encodeURI(window.TOPTOON_IMAGE_MAP?.[imageKey] || `assets/${market}/${filename}`) : "",
    searchText: ""
  };
}

function buildGroups(allRecords) {
  const byId = new Map();
  allRecords.forEach((record) => {
    if (!byId.has(record.character_id)) {
      byId.set(record.character_id, {
        id: record.character_id,
        locales: {},
        allRecords: [],
        viewsNumber: 0,
        chatsNumber: 0,
        searchText: ""
      });
    }
    const group = byId.get(record.character_id);
    group.locales[record.market] = record;
    group.allRecords.push(record);
    group.viewsNumber += record.viewsNumber;
    group.chatsNumber += record.chatsNumber;
  });

  const builtGroups = [...byId.values()].map((group) => {
    group.primary = MARKET_ORDER.map((market) => group.locales[market]).find(Boolean);
    group.name = group.primary.character_name;
    group.work = group.primary.workSafe;
    group.markets = MARKET_ORDER.filter((market) => group.locales[market]);
    group.searchText = group.allRecords
      .flatMap((record) => [record.character_name, record.workSafe, record.character_id])
      .join(" ")
      .toLowerCase();
    return group;
  });

  records = allRecords.map((record) => {
    const group = byId.get(record.character_id);
    record.group = group;
    record.searchText = group.searchText;
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
  state.view = VIEW_META[nextView] && !(PUBLIC_READ_ONLY && nextView === "settings") ? nextView : state.view;
  if (!nextView && legacyMarket && MARKET_META[legacyMarket]) state.view = "characters";
  state.market = MARKET_META[nextMarket] ? nextMarket : state.market;
  state.q = params.get("q") || "";
  state.work = params.get("work") || "";
  state.sort = params.get("sort") || state.sort;
}

function writeHash() {
  const params = new URLSearchParams();
  params.set("view", state.view);
  params.set("market", state.market);
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
        const preset = field.key === "KIS_STOCK_CODE" ? "134580" : field.key === "OPENROUTER_MODEL" ? "openai/gpt-4.1-mini" : "";
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

async function runAiAnalysis() {
  els.runAiAnalysis.disabled = true;
  els.aiAnalysisStatus.textContent = "OpenRouter가 현재 증거 스냅샷을 검토 중입니다...";
  els.aiAnalysisOutput.hidden = true;
  try {
    const response = await fetch("/api/analysis/openrouter", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    els.aiAnalysisOutput.textContent = payload.analysis;
    els.aiAnalysisOutput.hidden = false;
    els.aiAnalysisStatus.textContent = `${formatDateTime(payload.generated_at)} · ${payload.model} · LLM 해석은 원자료가 아닌 보조 검토입니다.`;
  } catch (error) {
    els.aiAnalysisStatus.textContent = `분석 실패: ${error.message}`;
  } finally {
    els.runAiAnalysis.disabled = false;
  }
}

function renderStatsDashboard() {
  if (!statsData) {
    els.statsCapturedAt.textContent = "통계 스냅샷 없음";
    els.statsCaveat.textContent = "data/stats.js를 찾지 못해 캐릭터 카탈로그만 표시합니다.";
    els.mainKpiGrid.innerHTML = "";
    els.statsDashboard.innerHTML = "";
    return;
  }

  els.statsCapturedAt.textContent = `${formatDateTime(statsData.captured_at)} 수집 스냅샷`;
  els.statsCaveat.textContent =
    "관측 기반 넛캐스트입니다. 공식 매출이 아니며, 3일 델타는 방향성만 보고 공시·시세와 반드시 분리해 해석합니다.";

  const latest = statsData.revenue_nowcast?.latest || {};
  const siteRevenue = statsData.site_revenue || {};
  const siteOverall = statsData.site_comparison?.overall || {};
  els.mainKpiGrid.innerHTML = renderStatCards([
    ["월매출 추정 범위", `약 ${formatWonBig(latest.revenue_mid)}`, `${formatWonBig(latest.revenue_low)}–${formatWonBig(latest.revenue_high)} · 최근 3일 환산`, "signal"],
    ["회사 제시 월매출 대비", latest.ir_ratio_pct != null ? `${latest.ir_ratio_pct.toFixed(1)}%` : "-", "회사 제시 9억원과 비교 · 검증 전", "neutral"],
    ["해외 추정 매출 비중", siteRevenue.overseas_contribution_pct != null ? `${siteRevenue.overseas_contribution_pct.toFixed(1)}%` : "-", `해외 누적 대화 ${formatNumber(siteOverall.overseas_total || 0)}`, "positive"],
    ["데이터 축적 기간", "3일", "추세 판단에는 최소 14일 권장", "warning"]
  ]);

  els.statsDashboard.innerHTML = [
    renderRevenuePanel(),
    renderGlobalPanel(),
    renderCompletionPanel(),
    renderGrowthPanel(),
    renderTotalsPanel()
  ].join("");
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
    renderMarketRisk(investor, marketView),
    renderPeerComparison(marketView),
    renderCatalogCrosscheck(validationData.catalogs || {}),
    renderRequiredCaveats(validationData.required_caveats || [], thesis)
  ].join("");

  els.validationDetail.innerHTML = [
    renderValidationChecks(validationData.checks || []),
    renderSourceLedger(investor.sources || [])
  ].join("");
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
        <span class="evidence-badge ${dart.status === "ok" ? "tier-a" : "tier-c"}">${dart.status === "ok" ? `${(dart.disclosures || []).length}건 확인` : "이전 정상값"}</span>
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
  const price = hasCurrentQuote ? Number(quote.price) : Number(market.close || 0);
  const reportedShares = Number(market.shares_outstanding || 0);
  const liveShares = Number(quote.shares_outstanding || 0);
  const shares = hasCurrentQuote && liveShares ? liveShares : reportedShares;
  const referenceClose = Number(market.reference_close || 0);
  return {
    price,
    previousClose: hasCurrentQuote ? Number(quote.previous_close || 0) || null : null,
    open: hasCurrentQuote ? Number(quote.open || 0) || null : null,
    high: hasCurrentQuote ? Number(quote.high || 0) || null : null,
    low: hasCurrentQuote ? Number(quote.low || 0) || null : null,
    change: hasCurrentQuote ? Number(quote.change || 0) : null,
    changePct: hasCurrentQuote ? Number(quote.change_pct || 0) : null,
    volume: hasCurrentQuote ? Number(quote.volume || 0) : Number(market.volume || 0),
    shares,
    marketCap: hasCurrentQuote && Number(quote.market_cap_krw || 0) ? Number(quote.market_cap_krw) : price * shares,
    fromReferencePct: referenceClose ? ((price / referenceClose) - 1) * 100 : 0,
    refreshedAt: hasCurrentQuote ? officialSignalsData?.generated_at : market.as_of,
    sourceLabel: hasCurrentQuote ? `KIS ${kis.status === "cached" ? "이전 정상값" : "최근 조회"}` : "2차 종가",
    isCurrent: hasCurrentQuote,
    shareCountChanged: Boolean(hasCurrentQuote && liveShares && reportedShares && liveShares !== reportedShares)
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
          ["연결 매출", formatWonBig(filing.revenue), `영업이익률 ${formatPercent(derived.h1_operating_margin_pct)}`],
          ["연결 영업이익", formatWonBig(filing.operating_profit), "반기 누계"],
          ["연결 순이익", formatWonBig(filing.net_income), "반기 누계"],
          ["영업현금흐름", formatWonBig(filing.operating_cash_flow), `순이익 대비 ${formatPercent(derived.operating_cash_conversion_pct)}`]
        ])}
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
  const derived = investor.derived || {};
  return `
    <section class="panel stats-panel validation-panel">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">Security setup</p>
          <h2>주가 기대·수급 위험</h2>
        </div>
        <span class="evidence-badge tier-c">시세 C · 공시 A</span>
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
      <p class="section-note">가격 상승은 사업 성과의 증거가 아닙니다. 실적 개선과 기대 선반영·저유통 수급을 분리해 판단해야 합니다.</p>
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
  const byCharacter = statsData.revenue_by_character || {};
  const coinMix = statsData.coin_mix_ramp || {};
  return `
    <section class="panel stats-panel signal-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">01 · 매출 가능성</p>
          <h2>추정 매출 범위와 인기 캐릭터</h2>
        </div>
        <span class="data-pill warning">3일 외삽 · C등급</span>
      </div>
      <p class="section-note metric-definition"><strong>캐릭터 기여도 정의:</strong> 캐릭터별 누적 공개 채팅수 ÷ 전체 누적 공개 채팅수입니다. 원화 환산액은 누적 chats × ₩2,354 가정이며, 실제 벌어온 금액이나 공시 매출이 아닙니다.</p>
      <div class="chart-grid chart-grid-primary">
        ${renderRevenueBand(revenue)}
        ${renderCharacterLeaderboard(byCharacter)}
      </div>
      <div class="chart-grid chart-grid-secondary">
        ${renderBarChart("유료 코인 결제 비중", "전체 결제에서 코인이 차지한 비율 · 회사 IR 제시값 · 외부 검증 전", (coinMix.ir_checkpoints || []).map((item) => ({
          label: `${String(item.month || "").slice(5)}월`,
          value: item.pct,
          sub: item.label || item.month
        })), (value) => `${Number(value || 0).toFixed(1)}%`, "#f5a742")}
        ${renderColumnChart("월별 캐릭터 반응 점수", "캐릭터당 원본 활동점수 평균 · 계산식 미공개 · 방향성만 참고", (coinMix.monthly_activity_index || []).map((item) => ({
          label: item.month,
          value: item.avg_score,
          sub: "avg score"
        })), (value) => formatNumber(Math.round(value)), "#62a8ff")}
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
        <span class="data-pill neutral">이론 상한</span>
      </div>
      <p class="section-note">실제 평균 결제액이 아닙니다. 활성 캐릭터 ${formatNumber(ceiling.active_count)}명과 평균 사진 ${formatNumber(ceiling.avg_photos)}장을 전부 소비하는 극단적 상한입니다.</p>
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

function renderGrowthPanel() {
  const growth = statsData.growth_cannibalization || {};
  return `
    <section class="panel stats-panel signal-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">04 · 캐릭터 공급·수요</p>
          <h2>신규 캐릭터 수와 대화 증가</h2>
        </div>
        <span class="data-pill positive">7개월 공급</span>
      </div>
      <p class="section-note">신규 캐릭터가 총 대화량을 끌어올리는지 보는 성장 검증 지표입니다. 평평하면 기존 캐릭터 잠식 가능성이 커집니다.</p>
      <div class="chart-grid chart-grid-primary">
        ${renderColumnChart("월별 신규 캐릭터", "실제 공개일 기준 · 명", (growth.monthly_new_characters || []).map((item) => ({
          label: item.month,
          value: item.count,
          sub: "new"
        })), (value) => `${formatNumber(value)}명`, "#f5a742")}
        ${renderColumnChart("전체 대화수 일간 증가", "3개 연속 관측 · chats", (growth.daily_total_chat_delta || []).map((item) => ({
          label: item.date.slice(5),
          value: item.delta,
          sub: item.date
        })), formatNumber, "#27c499")}
      </div>
      ${renderGenreBars(growth.genre_breakdown || [])}
    </section>
  `;
}

function renderTotalsPanel() {
  const totals = statsData.totals_timeseries?.rows || [];
  const dailyViews = statsData.daily_totals?.rows || [];
  const dailyChats = statsData.daily_chat_totals?.rows || [];
  const monthly = statsData.monthly_index?.rows || [];
  return `
    <section class="panel stats-panel signal-section">
      <div class="panel-heading compact-heading">
        <div>
          <p class="section-kicker">05 · 최근 관측 변화</p>
          <h2>처음 수집한 날과 현재 비교</h2>
        </div>
        <span class="data-pill warning">5개 스냅샷</span>
      </div>
      <p class="section-note">장기 추세가 아닙니다. 8월 18–24일 사이 저장한 5개 누적값에서 시작값·현재값·증가량을 비교합니다.</p>
      <div class="chart-grid chart-grid-primary">
        ${renderSnapshotJourney("누적 조회수", "전체 캐릭터 공개 조회수 합계", totals, "total_views", "#62a8ff")}
        ${renderSnapshotJourney("누적 대화수", "전체 캐릭터 공개 대화수 합계", totals, "total_chats", "#27c499")}
      </div>
      <div class="chart-grid chart-grid-secondary">
        ${renderPeriodComparison("최근 3일 조회 증가", "하루 동안 새로 늘어난 공개 조회수", dailyViews.map((item) => ({
          label: item.date.slice(5),
          value: item.delta,
          sub: item.date
        })), formatNumber, "#62a8ff")}
        ${renderPeriodComparison("최근 3일 대화 증가", "하루 동안 새로 늘어난 공개 대화수", dailyChats.map((item) => ({
          label: item.date.slice(5),
          value: item.delta,
          sub: item.date
        })), formatNumber, "#27c499")}
      </div>
      ${renderPeriodComparison("월별 캐릭터 반응 점수", "4–7월 캐릭터당 원본 활동점수 평균 · 계산식 미공개", monthly.map((item) => ({
        label: item.month,
        value: item.avg_score,
        sub: `${formatNumber(item.ranked_chars)} chars`
      })), (value) => formatNumber(Math.round(value)), "#d95926")}
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
  renderCatalogSummary();
  els.resultStatus.textContent = `${formatNumber(filtered.length)}개 표시`;
  els.emptyState.hidden = filtered.length > 0;
  els.tbody.innerHTML = filtered.map(renderTableRow).join("");
  els.cardList.innerHTML = filtered.map(renderCard).join("");
  bindResultButtons();
}

function renderCatalogSummary() {
  const source = state.market === "all" ? records : recordsForMarket(state.market);
  const uniqueCharacters = state.market === "all"
    ? dataset.counts.unique_character_ids
    : source.length;
  const views = source.reduce((sum, record) => sum + record.viewsNumber, 0);
  const chats = source.reduce((sum, record) => sum + record.chatsNumber, 0);
  const works = new Set(source.map((record) => record.work_title).filter(Boolean)).size;
  els.catalogKpiGrid.innerHTML = renderStatCards([
    ["캐릭터", formatNumber(uniqueCharacters), state.market === "all" ? "중복 지역을 합친 고유 ID" : `${MARKET_META[state.market].label} 공개 캐릭터`],
    ["조회수", formatNumber(views), state.market === "all" ? "4개 시장 공개 수치 합산" : "해당 시장 공개 조회수"],
    ["채팅", formatNumber(chats), state.market === "all" ? "4개 시장 공개 수치 합산" : "해당 시장 공개 채팅"],
    ["작품", formatNumber(works), "빈 작품명 제외"]
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
    if (state.sort === "name-asc") return aName.localeCompare(bName, "ko");
    if (state.sort === "work-asc") return aWork.localeCompare(bWork, "ko");
    return b.viewsNumber - a.viewsNumber;
  });
}

function recordsForMarket(market) {
  const site = MARKET_META[market].site;
  return records.filter((record) => record.site === site);
}

function renderTableRow(item) {
  const model = viewModel(item);
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
      <td class="metric">${formatNumber(model.chats)}</td>
      <td>${escapeHtml(model.counterparts)}</td>
    </tr>
  `;
}

function renderCard(item) {
  const model = viewModel(item);
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
          <span>조회수<strong>${formatNumber(model.views)}</strong></span>
          <span>채팅<strong>${formatNumber(model.chats)}</strong></span>
        </span>
      </button>
    </article>
  `;
}

function bindResultButtons() {
  bindImageFallbacks(document);
  [...document.querySelectorAll("[data-character-id]")].forEach((button) => {
    button.addEventListener("click", () => openDialog(Number(button.dataset.characterId), button));
  });
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

function renderCharacterMotion(model) {
  if (!model.videoSrc) return renderFullImage(model);
  const fallback = escapeHtml(model.fallback || "?");
  const poster = model.imageSrc ? escapeAttr(model.imageSrc) : "";
  return `
    <div class="character-motion-shell">
      <video class="character-motion" autoplay muted loop playsinline preload="metadata"${poster ? ` poster="${poster}"` : ""} aria-label="${escapeAttr(`${model.name} 공식 모션 미리보기`)}">
        <source src="${escapeAttr(model.videoSrc)}" type="video/mp4" />
      </video>
      <div class="motion-fallback" aria-hidden="true">
        ${model.imageSrc ? renderFullImage(model) : `<span class="thumb-fallback thumb-full">${fallback}</span>`}
      </div>
      <span class="motion-badge"><i></i> 공식 모션</span>
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

function openDialog(characterId, trigger) {
  const group = groups.find((candidate) => candidate.id === characterId);
  if (!group) return;
  const selected =
    state.market === "all" ? group.primary : group.locales[state.market] || group.primary;
  lastTrigger = trigger;
  els.dialogContent.innerHTML = renderDialogContent(group, selected);
  bindImageFallbacks(els.dialogContent);
  bindMotionFallbacks(els.dialogContent);
  if (typeof els.dialog.showModal === "function") {
    els.dialog.showModal();
  } else {
    els.dialog.setAttribute("open", "");
  }
}

function bindMotionFallbacks(root) {
  [...root.querySelectorAll(".character-motion")].forEach((video) => {
    const shell = video.closest(".character-motion-shell");
    video.addEventListener("playing", () => shell?.classList.add("is-playing"), { once: true });
    video.addEventListener("error", () => shell?.classList.add("is-fallback"), { once: true });
    video.play().catch(() => {
      video.controls = true;
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
  const officialLink = selected.detail_url
    ? `<a class="ghost-button dialog-open-link" href="${escapeAttr(selected.detail_url)}" target="_blank" rel="noopener noreferrer">공식 캐릭터 페이지</a>`
    : "";
  return `
    <div class="dialog-hero">
      <div class="dialog-image-frame">
        ${renderCharacterMotion(model)}
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
      <div><span>Character ID</span><strong>${group.id}</strong></div>
      <div><span>조회수</span><strong>${formatNumber(selected.viewsNumber)}</strong></div>
      <div><span>채팅</span><strong>${formatNumber(selected.chatsNumber)}</strong></div>
    </div>
    <h3>지역별 캐릭터 정보</h3>
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
      ([label, value, help, tone = "neutral"]) => `
        <article class="stat-card tone-${escapeAttr(tone)}">
          <span class="stat-label">${escapeHtml(label)}</span>
          <strong class="stat-value">${escapeHtml(value ?? "-")}</strong>
          <p class="stat-help">${escapeHtml(help ?? "")}</p>
        </article>
      `
    )
    .join("");
}

function renderCharacterLeaderboard(byCharacter) {
  const top = (byCharacter.top || []).slice(0, 6);
  const totalChats = Number(byCharacter.total_chats || 0) || 1;
  return `
    <article class="chart-card span-5 character-rank-card">
      <div class="chart-heading">
        <div>
          <h3>인기 캐릭터 TOP 6</h3>
          <p class="stat-help">누적 공개 대화수 순위 · 사진 선택 시 전체 정보</p>
        </div>
        <span class="sample-badge">TOP 6</span>
      </div>
      <div class="character-rank-grid">
        ${top.map((item, index) => {
          const group = groups.find((entry) => entry.id === Number(item.character_id));
          const primary = group?.locales?.kr || group?.primary;
          const work = primary?.workSafe || MISSING_WORK;
          const imageSrc = primary?.imageSrc || "";
          const share = (Number(item.chats || 0) / totalChats) * 100;
          const marketLabels = (group?.markets || []).map((market) => MARKET_META[market].short).join(" · ") || "KR";
          const tooltipId = `rank-tooltip-${item.character_id}`;
          const views = Number(primary?.viewsNumber || 0);
          return `
            <button class="character-rank-item rank-${index + 1}" type="button" data-character-id="${item.character_id}" aria-describedby="${tooltipId}">
              <span class="rank-number">${index + 1}</span>
              <span class="rank-image-frame">
                ${imageSrc
                  ? `<img class="thumb rank-image" src="${escapeAttr(imageSrc)}" alt="${escapeAttr(`${item.name} 캐릭터 이미지`)}" loading="lazy" data-fallback="${escapeAttr(String(item.name || "?").slice(0, 1))}" />`
                  : `<span class="rank-image rank-fallback">${escapeHtml(String(item.name || "?").slice(0, 1))}</span>`}
              </span>
              <span class="rank-name">${escapeHtml(item.name || `#${item.character_id}`)}</span>
              <span class="rank-traffic">
                <span><small>조회수</small><strong>${formatCompact(views)}</strong></span>
                <span><small>공개 대화</small><strong>${formatCompact(item.chats)}</strong></span>
              </span>
              <span class="rank-revenue"><small>가정 환산액</small><strong>${formatWonBig(item.revenue)}</strong></span>
              <span class="rank-tooltip" id="${tooltipId}" role="tooltip">
                <strong>${escapeHtml(item.name || `#${item.character_id}`)}</strong>
                <span>작품 · ${escapeHtml(work)}</span>
                <span>누적 대화 · ${formatNumber(item.chats)}회</span>
                <span>전체 대화 비중 · ${share.toFixed(1)}%</span>
                <span>단순 환산액 · ${formatWonBig(item.revenue)}</span>
                <span>확인 시장 · ${escapeHtml(marketLabels)}</span>
                <small>누적 대화 × 2,354원 · 실제 매출 아님</small>
              </span>
            </button>
          `;
        }).join("")}
      </div>
      <p class="chart-tail">환산액 = 공개 대화 × 2,354원 가정입니다. 실제 매출이 아니며, 클릭하면 전체 이미지와 국가별 정보가 열립니다.</p>
    </article>
  `;
}

function renderSnapshotJourney(title, subtitle, rows, key, color) {
  const first = Number(rows[0]?.[key] || 0);
  const latest = Number(rows.at(-1)?.[key] || 0);
  const change = latest - first;
  const changePct = first ? (change / first) * 100 : 0;
  const firstDate = rows[0]?.date?.slice(5) || "-";
  const latestDate = rows.at(-1)?.date?.slice(5) || "-";
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
            <span>${escapeHtml(row.date.slice(5))}</span>
            <strong>${formatCompact(Number(row[key] || 0))}</strong>
          </div>
        `).join("")}
      </div>
      <p class="chart-tail">5회 관측값은 참고용이며, 핵심 비교는 첫 수집값과 현재값의 절대 증가량입니다.</p>
    </article>
  `;
}

function renderPeriodComparison(title, subtitle, rows, formatter = formatNumber, color = "#3987e5", className = "") {
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
        <div><span>현재 · ${escapeHtml(String(latest?.label || "-"))}</span><strong>${latest ? escapeHtml(formatter(latest.value)) : "-"}</strong></div>
        <div class="period-change ${latestChange < 0 ? "is-lower" : "is-higher"}">
          <span>직전 기간 대비</span>
          <strong>${latestChange < 0 ? "▼" : "▲"} ${Math.abs(latestPct).toFixed(1)}%</strong>
          <small>${latestChange >= 0 ? "+" : "−"}${escapeHtml(formatter(Math.abs(latestChange)))}</small>
        </div>
        <div><span>기간 최고</span><strong>${escapeHtml(String(high?.label || "-"))}</strong></div>
      </div>
      <div class="period-list">
        ${rows.map((row, index) => {
          const value = Number(row.value || 0);
          const prior = Number(rows[index - 1]?.value || 0);
          const delta = index && prior ? ((value - prior) / prior) * 100 : null;
          const width = Math.max(4, (value / max) * 100);
          return `<div class="period-row">
            <span class="period-label">${escapeHtml(String(row.label).replace(/^2026-/, ""))}</span>
            <span class="period-track"><i style="width:${width}%"></i></span>
            <strong>${escapeHtml(formatter(value))}</strong>
            <small class="${delta == null ? "" : delta < 0 ? "is-lower" : "is-higher"}">${delta == null ? "기준" : `${delta < 0 ? "▼" : "▲"} ${Math.abs(delta).toFixed(1)}%`}</small>
          </div>`;
        }).join("")}
      </div>
    </article>
  `;
}

function renderRevenueBand(revenue) {
  const rows = revenue.daily || [];
  const benchmark = revenue.ir_benchmark?.monthly || 0;
  const latest = revenue.latest || rows.at(-1) || {};
  const values = rows.flatMap((row) => [row.revenue_low, row.revenue_mid, row.revenue_high]);
  if (benchmark) values.push(benchmark);
  const max = Math.max(...values.map(Number), 1);
  const benchmarkRatio = benchmark ? (Number(latest.revenue_mid || 0) / benchmark) * 100 : 0;
  return `
    <article class="chart-card span-7 revenue-range-card">
      <div class="chart-heading"><div><h3>월매출 추정: 얼마까지 볼 수 있나?</h3><p class="stat-help">최근 대화 증가를 30일로 환산 · 세션당 2,000~2,700원 가정</p></div><span class="sample-badge">최근 ${rows.length}일</span></div>
      <div class="revenue-headline">
        <div><span>현재 기준 시나리오</span><strong>${formatWonBig(latest.revenue_mid)}</strong><small>월 환산 · 공시 매출 아님</small></div>
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
      <div class="benchmark-key"><span></span><strong>현재 기준값은 IR 제시 ${formatWonBig(benchmark)}의 ${benchmarkRatio.toFixed(1)}%</strong><small>IR 수치는 외부 검증 전 비교 기준</small></div>
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

function renderColumnChart(title, subtitle, rows, formatter = formatNumber, color = "#3987e5", className = "") {
  const max = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  const high = rows.reduce((best, row) => Number(row.value || 0) > Number(best?.value ?? -Infinity) ? row : best, null);
  const deltaPct = Number(previous?.value || 0) ? ((Number(latest?.value || 0) / Number(previous.value)) - 1) * 100 : 0;
  return `
    <article class="chart-card ${escapeAttr(className)}">
      <div class="chart-heading"><div><h3>${escapeHtml(title)}</h3><p class="stat-help">${escapeHtml(subtitle || "")}</p></div><span class="sample-badge">${rows.length}개 기간</span></div>
      <div class="chart-readout">
        <div><span>최근</span><strong>${latest ? escapeHtml(formatter(latest.value)) : "-"}</strong></div>
        <div><span>직전 대비</span><strong class="${deltaPct >= 0 ? "is-up" : "is-down"}">${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%</strong></div>
        <div><span>기간 최고</span><strong>${high ? escapeHtml(String(high.label).replace(/^2026-/, "")) : "-"}</strong></div>
      </div>
      <div class="column-chart" style="--columns:${Math.max(rows.length, 1)}">
        ${rows.map((row) => {
          const height = Math.max(4, (Number(row.value || 0) / max) * 100);
          return `<div class="column-item" title="${escapeAttr(`${row.label} ${formatter(row.value)}`)}">
            <strong>${escapeHtml(formatter(row.value))}</strong>
            <span class="column-track"><i style="height:${height}%;background:${color}"></i></span>
            <small>${escapeHtml(String(row.label).replace(/^2026-/, ""))}</small>
          </div>`;
        }).join("")}
      </div>
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

function renderGenreBars(rows) {
  const max = Math.max(...rows.map((row) => Number(row.total_chats || 0)), 1);
  return `
    <article class="chart-card full-span">
      <div class="chart-heading"><div><h3>장르별 대화 구성</h3><p class="stat-help">누적 대화수 기준 · 캐릭터 수 병기</p></div><span class="sample-badge">${rows.length}개 장르</span></div>
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
