# Taiwan, full-art viewer, and statistics dashboard

## Overview

Extend the existing static tracker with Taiwan as a fourth locale, make portrait artwork fully visible after selection, and reproduce the original tracker's main statistics screen from its public snapshot APIs.

## DOM Structure

- Primary view navigation: `통계` and `캐릭터`.
- Statistics view: snapshot notice, core KPI row, revenue nowcast, completion ceiling, growth, cumulative totals, daily deltas, top character contribution.
- Character view: existing snapshot summary, market tabs (`통합`, `한국`, `日本`, `Global`, `台灣`), filters, table/cards.
- Character dialog: large portrait art region, metadata, per-locale rows, official links.

## Computed Styles

- Reuse existing tracker tokens: dark `#0b0d12` page, `#151822` panels, `#3987e5` primary accent.
- Statistics panels use the original source's dense panel rhythm and chart palette.
- Full art uses `object-fit: contain`, not `cover`, inside a responsive portrait matte.
- Taiwan market indicator uses `#22b8a7`.

## States and Behaviors

- Default view is statistics, matching the reference main screen.
- View and market state are URL-hash addressable.
- Statistics are a dated local snapshot; no claims of live data.
- Clicking any character row/card opens the full-art dialog; Escape/native dialog close restores focus.
- Market, search, work, and sort behavior remain unchanged and add Taiwan.

## Per-State Content

- Statistics: source timestamp, caveat labels, values and charts from the Worker public endpoints.
- Character catalog: integrated totals or one selected market.
- Dialog: selected locale artwork/name/work/metrics plus every available locale counterpart.
- Missing work title: `작품 정보 없음`; missing art: accessible initials fallback.

## Assets

- Existing local KR/JP/Global images.
- New unmodified public Taiwan thumbnails in `assets/tw`.
- No copied site logos, locked album images, or authenticated assets.

## Text Content

- Keep the original Korean statistical headings and explicit caveats that the revenue model and IR figures are estimates or unverified company claims.
- Add `台灣` and `繁體中文` for the Taiwan locale.

## Responsive Behavior

- Four KPI cards collapse to two then one column.
- Chart panels remain horizontally safe at 390 px and use SVG/CSS visualization where possible.
- Character table switches to cards below 720 px.
- Full-art dialog stacks portrait above metadata on narrow screens.

## Original Implementation Inventory

- Reference page: server-rendered single HTML document with custom canvas chart helpers and public JSON endpoints.
- Existing local app: zero-dependency HTML/CSS/JS, embedded snapshot bundle, native dialog, Node static server.
- Implementation keeps the zero-dependency architecture and snapshots the public API payloads locally.

## Parity Decision

Reproduce the reference main statistics information architecture, headings, caveats, key values, colors, and comparable charts. Do not copy branding or authenticated behavior. Use accessible DOM/SVG charts rather than duplicating the source canvas implementation verbatim.
