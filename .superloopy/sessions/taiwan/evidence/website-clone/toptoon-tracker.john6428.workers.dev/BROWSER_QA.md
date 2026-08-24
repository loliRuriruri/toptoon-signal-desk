# Browser QA: Taiwan extension and statistics

STATUS: PASS

Target: `http://127.0.0.1:8788/` through the in-app Browser, 2026-08-24.

## Statistics view

- Default URL view is `stats`; character catalog is hidden.
- KPI values rendered: monthly revenue run-rate about 6.2억원, profit about 3.1억원, IR ratio 68.6%, overseas contribution 35.1%.
- Five main panels rendered: revenue nowcast, global expansion, completion ceiling, growth/cannibalization, cumulative and daily activity.
- No horizontal overflow in the desktop Browser viewport.
- Screenshot: `qa-desktop-stats-top.png`.

## Taiwan catalog

- URL state: `#view=characters&market=tw`.
- Result count: 81 rows/cards.
- KPI: 81 characters, 3,162,422 views, 94,687 chats, 64 works.
- First image sources are local `assets/tw/*`, not remote hotlinks.
- Cross-locale search `한나리` returned Traditional Chinese `林映純`.
- Empty search produced 0 results and the reset button restored the catalog.
- Integrated view restored 104 unique character IDs.
- Screenshot: `qa-desktop-taiwan-top.png`.

## Full-art dialog

- Selected Taiwan character image source is local.
- Observed natural size: 832 x 1216.
- Computed `object-fit`: `contain`.
- Image bounding box stayed fully inside the matte frame on desktop and sub-390px mobile.
- Official outbound route pointed to `https://chat.toptoon.net/detail/character/1` with safe new-tab behavior.
- Screenshots: `qa-desktop-full-art.png`, `qa-mobile-full-art.png`.

## Mobile risk path

- Effective narrow viewport was 337 px inside the app browser.
- Document horizontal overflow: false.
- Table hidden, card list displayed, 81 Taiwan cards present.
- Full-art dialog stacked content and kept the portrait fully inside its frame.
