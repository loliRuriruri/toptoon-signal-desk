STATUS: DONE_WITH_CONCERNS

SCENARIOS:
- Automated static validation: PASS. `node scripts/validate.mjs` returned `Validation passed: data, assets, DOM markers, style markers, and app.js syntax are OK.`
- Syntax validation: PASS. `node --check app.js` and `node --check data/characters.js` exited 0 with no output.
- Data and asset integrity: PASS. `data/characters.json` contains 247 locale records: KR 87, JP 77, GLOBAL 83, declared unique character IDs 100. Local thumbnail path resolution found `missingImageCount: 0` and `duplicateSiteCharacterIds: 0`.
- Static server reachability: PASS. `Invoke-WebRequest http://127.0.0.1:8788/` returned HTTP 200, length 4600, title `TOPTOON CHAT TRACKER`.
- Initial desktop render: PARTIAL PASS. Playwright CLI opened `http://127.0.0.1:8788/`; page title was `TOPTOON CHAT TRACKER`. DOM eval showed selected `all` tab, `100개 표시`, 100 table rows, 100 cards, and populated stat cards.
- Desktop/dialog artifact capture: PARTIAL PASS. QA-only Playwright script captured `usopp-desktop-1440.png` and `usopp-dialog-jp.png` before later wait/navigation failures.
- Tabs/search/sort/dialog full scripted pass: NEEDS_CONTEXT. Independent script did not complete reliably; retries hit Playwright navigation timeouts and one closed-dialog selector wait mismatch. Parent handoff says separate parent browser evidence exists, but this USOPP pass cannot independently claim full tab/search/dialog pass.
- Mobile/responsive live browser verification: NEEDS_CONTEXT. Not completed in this pass because Playwright CLI navigation became unreliable. Static CSS audit found expected responsive markers: 880/720/520 breakpoints, table hidden/card list grid at mobile breakpoint, horizontal overflow controls, and `overflow-wrap: anywhere`.

COMMANDS:
- `node scripts/validate.mjs` -> exit 0; validation passed.
- `node --check app.js` -> exit 0.
- `node --check data/characters.js` -> exit 0.
- `node -e "...data/assets count probe..."` -> exit 0; 247 records, KR 87, JP 77, GLOBAL 83, missing images 0, duplicate site-character IDs 0.
- `Get-ChildItem assets\kr,assets\jp,assets\global -File | Group-Object DirectoryName | ConvertTo-Json` -> KR 87 asset files, JP 77 asset files, Global 83 asset files.
- `Invoke-WebRequest -Uri http://127.0.0.1:8788/ -UseBasicParsing -TimeoutSec 5` -> HTTP 200, title `TOPTOON CHAT TRACKER`.
- `npx.cmd --yes --package @playwright/cli playwright-cli open http://127.0.0.1:8788/` -> opened browser, title correct, but console showed image request errors.
- `npx.cmd --yes --package @playwright/cli playwright-cli eval "..."` -> initial DOM state: `100개 표시`, selected `all`, 100 rows, 100 cards.
- `npx.cmd --yes --package @playwright/cli playwright-cli requests` -> observed intermittent thumbnail request failures such as `net::ERR_CONNECTION_RESET`; direct filesystem asset check still passed.
- `npx.cmd --yes --package @playwright/cli playwright-cli run-code --filename ...\usopp-browser-check.js` -> created desktop/dialog screenshots in one run, but did not complete all checks due timeout/wait failures.
- `node -e "...CSS marker probe..."` -> exit 0; responsive marker checks all true.
- `npx.cmd --yes --package @playwright/cli playwright-cli close` -> browser closed.

ARTIFACTS:
- `USOPP_QA.md`
- `usopp-browser-check.js`
- `usopp-desktop-1440.png`
- `usopp-dialog-jp.png`

OBSERVED:
- The data layer and local assets are internally consistent for the requested unified KR/JP/Global snapshot.
- The app loads from the local server and the initial unified UI renders with 100 grouped characters, matching `unique_character_ids`.
- The static CSS includes mobile/responsive fallbacks that should hide the table and show cards under 720px, but this pass did not complete a live mobile viewport assertion.
- Playwright CLI repeatedly reported local thumbnail request resets and later navigation timeouts, despite direct HTTP returning the page and the filesystem asset audit passing. This may be harness/server concurrency behavior from Python `http.server`, but it is still unresolved in this QA pass.

RISKS:
- Full independent live-browser coverage for tabs, cross-script search, sort, empty reset, focus return, and mobile overflow was not completed by this USOPP pass.
- Intermittent `net::ERR_CONNECTION_RESET` on local thumbnail requests could affect perceived image reliability under the current static server, even though every referenced image exists locally.

UPDATE 2026-08-24T16:44+09:00:
- Bounded mobile live check on the dependency-free concurrent Node server `http://127.0.0.1:8789/`: PASS.
- Command: `npx.cmd --yes --package @playwright/cli playwright-cli run-code --filename .superloopy\evidence\website-clone\toptoon-tracker.john6428.workers.dev\usopp-mobile-8789-check.js`
- Result: `{"url":"http://127.0.0.1:8789/","viewport":{"width":390,"height":900},"status":"100개 표시","tableDisplay":"none","cardDisplay":"grid","cardCount":100,"documentScrollWidth":390,"documentClientWidth":390,"noHorizontalOverflow":true}`
- Artifact: `usopp-mobile-8789.png`

RECOMMENDATION: PASS
