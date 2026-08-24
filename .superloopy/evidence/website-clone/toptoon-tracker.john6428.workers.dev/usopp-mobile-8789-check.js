async (page) => {
  page.setDefaultNavigationTimeout(15000);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("http://127.0.0.1:8789/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#card-list .character-card", { timeout: 10000 });
  await page.screenshot({
    path:
      "C:/TEST/toptoon-tracker-unified/.superloopy/evidence/website-clone/toptoon-tracker.john6428.workers.dev/usopp-mobile-8789.png",
    fullPage: true
  });
  return page.evaluate(() => {
    const table = document.querySelector("#table-wrap");
    const cards = document.querySelector("#card-list");
    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      status: document.querySelector("#result-status")?.textContent,
      tableDisplay: getComputedStyle(table).display,
      cardDisplay: getComputedStyle(cards).display,
      cardCount: document.querySelectorAll("#card-list .character-card").length,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      noHorizontalOverflow:
        document.documentElement.scrollWidth === document.documentElement.clientWidth
    };
  });
}
