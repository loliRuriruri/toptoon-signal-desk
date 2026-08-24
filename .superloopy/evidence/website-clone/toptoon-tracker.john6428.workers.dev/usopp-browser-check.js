async (page) => {
  const evidenceRoot =
    "C:/TEST/toptoon-tracker-unified/.superloopy/evidence/website-clone/toptoon-tracker.john6428.workers.dev";
  const waitForRender = async () => {
    await page.waitForSelector("#character-tbody tr, #empty-state:not([hidden])", { timeout: 5000 });
    await page.waitForTimeout(250);
  };
  const state = async () =>
    page.evaluate(() => ({
      hash: location.hash,
      label: document.querySelector("#active-market-label")?.textContent,
      status: document.querySelector("#result-status")?.textContent,
      rows: document.querySelectorAll("#character-tbody tr").length,
      cards: document.querySelectorAll("#card-list .character-card").length,
      emptyHidden: document.querySelector("#empty-state")?.hidden,
      selectedTab: document.querySelector(".tab-button[aria-selected='true']")?.dataset.tab,
      search: document.querySelector("#search-input")?.value,
      sort: document.querySelector("#sort-select")?.value,
      firstRows: [...document.querySelectorAll("#character-tbody tr")]
        .slice(0, 3)
        .map((row) => row.innerText),
      visibleImageState: [...document.querySelectorAll("img.thumb")]
        .slice(0, 20)
        .map((img) => ({ src: img.getAttribute("src"), complete: img.complete, width: img.naturalWidth }))
    }));
  const clickTab = async (tab) => {
    await page.locator(`[data-tab="${tab}"]`).click();
    await waitForRender();
    return state();
  };
  const search = async (query) => {
    await page.locator("#search-input").fill(query);
    await page.locator("#search-input").dispatchEvent("input");
    await waitForRender();
    return state();
  };

  const results = {};
  page.setDefaultNavigationTimeout(10000);
  await page.route(/\.(png|jpg|jpeg|webp)$/i, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:8788/", { waitUntil: "domcontentloaded" });
  await waitForRender();
  results.initial = await state();
  await page.screenshot({ path: `${evidenceRoot}/usopp-desktop-1440.png`, fullPage: true });

  results.tabs = {
    all: await clickTab("all"),
    kr: await clickTab("kr"),
    jp: await clickTab("jp"),
    global: await clickTab("global")
  };

  await clickTab("all");
  results.searchJapaneseInAll = await search("下北愛梨");
  results.searchEnglishInAll = await search("Alice");
  results.emptySearch = await search("zzzz-no-character");
  await page.locator("#reset-filters").click();
  await waitForRender();
  results.afterReset = await state();

  await page.locator("#sort-select").selectOption("name-asc");
  await waitForRender();
  results.sortNameAsc = await state();

  await clickTab("jp");
  await search("下北愛梨");
  const firstButton = page.locator("[data-character-id]").first();
  const triggerText = await firstButton.evaluate((button) => button.innerText);
  await firstButton.click();
  await page.waitForSelector("dialog[open]", { timeout: 5000 });
  results.dialog = await page.evaluate(() => ({
    open: document.querySelector("#character-dialog")?.open,
    title: document.querySelector("#dialog-title")?.textContent,
    kicker: document.querySelector(".dialog-title-block .section-kicker")?.textContent,
    localeItems: [...document.querySelectorAll(".locale-item")].map((item) => item.innerText),
    focusedTag: document.activeElement?.tagName,
    triggerTextBeforeOpen: document.body.dataset.triggerText
  }));
  results.dialog.triggerText = triggerText;
  await page.screenshot({ path: `${evidenceRoot}/usopp-dialog-jp.png`, fullPage: true });
  await page.locator("#dialog-close").click();
  await page.waitForFunction(() => !document.querySelector("#character-dialog")?.open, {
    timeout: 5000
  });
  results.dialogAfterClose = await page.evaluate(() => ({
    open: document.querySelector("#character-dialog")?.open,
    activeElementText: document.activeElement?.innerText,
    activeElementCharacterId: document.activeElement?.dataset?.characterId
  }));

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("http://127.0.0.1:8788/#tab=global&q=Fiona", { waitUntil: "domcontentloaded" });
  await waitForRender();
  results.mobile = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    status: document.querySelector("#result-status")?.textContent,
    tableDisplay: getComputedStyle(document.querySelector("#table-wrap")).display,
    cardDisplay: getComputedStyle(document.querySelector("#card-list")).display,
    cards: document.querySelectorAll("#card-list .character-card").length,
    bodyScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.documentElement.clientWidth,
    overflowingElements: [...document.querySelectorAll("body *")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .slice(0, 10)
      .map((el) => ({ tag: el.tagName, cls: el.className, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
  }));
  await page.screenshot({ path: `${evidenceRoot}/usopp-mobile-390.png`, fullPage: true });

  return results;
}
