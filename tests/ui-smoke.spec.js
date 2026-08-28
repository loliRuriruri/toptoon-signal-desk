const { test, expect } = require("@playwright/test");

test("signal, validation, and character flows render without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.locator(".site-header").evaluate((element) => { element.style.position = "static"; });
  await expect(page.getByRole("heading", { name: "사업 모멘텀 한눈에 보기" })).toBeVisible();
  await expect(page.locator(".snapshot-flow")).toHaveCount(2);
  await expect(page.locator(".period-comparison-card")).toHaveCount(3);
  await expect(page.locator(".character-rank-item")).toHaveCount(6);
  await expect(page.locator(".business-scope-bar")).toBeVisible();
  await expect(page.locator("[data-leaderboard-market]")).toHaveCount(5);
  await expect(page.locator(".leaderboard-scope-note")).toContainText("통합 상단 선택 적용 중");
  const japanRankingTab = page.locator('[data-leaderboard-market="jp"]');
  await japanRankingTab.click();
  await expect(japanRankingTab).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".leaderboard-scope-note")).toContainText("日本 TOP6 단독 선택");
  await expect(page.locator(".character-rank-card .stat-help")).toContainText("日本 공개 데이터 대화수 순위");
  await expect(page.locator(".character-rank-item")).toHaveCount(6);
  await expect(page.locator('[data-stats-market="all"]')).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "상단 선택으로 돌아가기" }).click();
  await expect(page.locator(".leaderboard-scope-note")).toContainText("통합 상단 선택 적용 중");
  await page.locator('[data-stats-market="jp"]').click();
  await expect(page.locator(".leaderboard-scope-note")).toContainText("日本 상단 선택 적용 중");
  await expect(page.locator('[data-leaderboard-market="jp"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-stats-market="all"]').click();
  await expect(page.locator(".leaderboard-scope-note")).toContainText("통합 상단 선택 적용 중");
  await expect(page.locator(".rank-revenue").first()).toContainText("시장 내 대화 비중");
  await expect(page.locator(".sample-badge").filter({ hasText: /^N=/ })).toHaveCount(0);
  await page.locator(".character-rank-item").first().hover();
  await expect(page.locator(".rank-tooltip").first()).toContainText("유료 결제·매출 순위가 아님");
  await page.waitForFunction(() => [...document.querySelectorAll(".rank-image")].every((image) => image.complete && image.naturalWidth > 0));
  await page.locator(".character-rank-item").first().evaluate((element) => element.blur());
  await page.locator(".character-rank-card h3").hover();
  await page.mouse.move(1400, 20);
  await page.locator(".character-rank-card").screenshot({ path: "output/playwright/ranking-desktop.png" });
  await page.locator(".character-rank-item").first().focus();
  await expect(page.locator(".rank-tooltip").first()).toBeVisible();
  await page.locator(".character-rank-item").first().click();
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.locator("#dialog-close").click();
  await page.locator("section").filter({ hasText: "최근 관측 변화" }).last().screenshot({ path: "output/playwright/observation-desktop.png" });

  await page.getByRole("button", { name: "공시·주가 검증" }).click();
  await expect(page.getByRole("heading", { name: "2026년 상반기 확정 재무실적" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "최근 회사 공시" })).toBeVisible();
  await expect(page.getByText("KIS 최근 조회").first()).toBeVisible();
  await expect(page.getByText("투자 판단 보류")).toBeVisible();
  await expect(page.getByRole("heading", { name: "OpenRouter 증거 검토" })).toBeVisible();
  await expect(page.locator("#validation-view .settings-connection-panel")).toHaveCount(0);
  const validationOrder = await page.evaluate(() => ({
    filing: document.querySelector("#validation-dashboard")?.getBoundingClientRect().top,
    ai: document.querySelector("#run-ai-analysis")?.getBoundingClientRect().top,
    checks: document.querySelector("#validation-detail")?.getBoundingClientRect().top
  }));
  expect(validationOrder.filing).toBeLessThan(validationOrder.ai);
  expect(validationOrder.ai).toBeLessThan(validationOrder.checks);
  await page.locator("#validation-dashboard").screenshot({ path: "output/playwright/validation-priority-desktop.png" });

  await page.getByRole("button", { name: "캐릭터" }).click();
  await expect(page.getByText("전체 104명 표시")).toBeVisible();
  await page.locator('[data-character-id="1"]:visible').first().click();
  const characterDialog = page.locator("#character-dialog");
  await expect(characterDialog).toBeVisible();
  await expect(characterDialog.locator(".character-motion, .thumb-full").first()).toBeVisible();
  const profileSummary = characterDialog.locator(".dialog-profile-summary");
  await expect(profileSummary).toBeVisible();
  await expect(profileSummary).toContainText("공식 카탈로그 소개");
  await expect(profileSummary.locator(".dialog-profile-link")).toHaveAttribute("href", /^https:\/\/chat\.toptoon\./);
  const linkedProfileSummary = await profileSummary.innerText();
  const dialogMarketSwitcher = characterDialog.locator(".dialog-market-switcher");
  await expect(dialogMarketSwitcher).toBeVisible();
  await expect(characterDialog.locator('.motion-chip[data-dialog-market="jp"]')).toHaveCount(1);
  const dialogScrollState = await characterDialog.evaluate((dialog) => ({
    top: dialog.getBoundingClientRect().top,
    scrollHeight: dialog.scrollHeight,
    clientHeight: dialog.clientHeight
  }));
  if (dialogScrollState.scrollHeight > dialogScrollState.clientHeight + 2) {
    await characterDialog.evaluate((dialog) => { dialog.scrollTop = dialog.scrollHeight; });
    const stickySwitcherTop = await dialogMarketSwitcher.evaluate((element) => element.getBoundingClientRect().top);
    expect(stickySwitcherTop - dialogScrollState.top).toBeLessThan(40);
    await characterDialog.evaluate((dialog) => { dialog.scrollTop = 0; });
  }
  const linkedDialogMetrics = await characterDialog.locator(".dialog-metrics").innerText();
  await characterDialog.locator('.motion-chip[data-dialog-market="jp"]').click();
  await expect(characterDialog.locator(".dialog-title-block .section-kicker")).toHaveText("日本");
  await expect(characterDialog.locator(".dialog-market-scope-note")).toContainText("日本 프로필 단독 선택");
  await expect(characterDialog.locator(".dialog-metrics")).toContainText("日本 시간당 평균 조회");
  await expect(characterDialog.locator(".dialog-metrics")).not.toHaveText(linkedDialogMetrics);
  await expect(profileSummary).toContainText("日本");
  await expect(profileSummary).not.toHaveText(linkedProfileSummary);
  await expect(characterDialog.locator('.motion-chip[data-dialog-market="jp"]')).toHaveAttribute("aria-pressed", "true");
  await characterDialog.getByRole("button", { name: "상단 선택으로 돌아가기" }).click();
  await expect(characterDialog.locator(".dialog-market-scope-note")).toContainText("통합 상단 선택 적용 중");
  await expect(characterDialog.locator(".dialog-title-block .section-kicker")).toHaveText("한국");
  await page.locator("#dialog-close").click();

  await page.getByRole("button", { name: "API 설정" }).click();
  await expect(page.getByRole("heading", { name: "API 연결 설정" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "API 연결 상태" })).toBeVisible();
  await expect(page.locator("#settings-view .ai-analysis-panel")).toHaveCount(0);
  await expect(page.locator("input[name='OPENROUTER_API_KEY']")).toHaveAttribute("type", "password");
  await expect(page.getByText("키 저장됨 · 연결 검사 가능").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("mobile ranking stays usable without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".site-header").evaluate((element) => { element.style.position = "static"; });
  await expect(page.locator(".character-rank-item")).toHaveCount(6);
  await expect(page.locator(".rank-image").first()).toBeVisible();
  const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
  await page.locator(".character-rank-card").screenshot({ path: "output/playwright/ranking-mobile.png" });
  await page.locator("section").filter({ hasText: "최근 관측 변화" }).last().screenshot({ path: "output/playwright/observation-mobile.png" });
});

test("public build is read-only and exposes no credential controls", async ({ page }) => {
  await page.goto("/?public-preview=1#view=settings");
  await expect(page.getByRole("button", { name: "API 설정" })).toHaveCount(0);
  await expect(page.locator("#settings-view")).toHaveCount(0);
  await expect(page.locator("#run-ai-analysis")).toHaveCount(0);
  await expect(page.getByText("PUBLIC SNAPSHOT")).toBeVisible();
  await expect(page.getByRole("heading", { name: "사업 모멘텀 한눈에 보기" })).toBeVisible();
});
