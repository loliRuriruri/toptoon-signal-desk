# Browser QA — 2026-08-24

Target: `http://127.0.0.1:8788/`

## Happy paths

- Initial integrated view: `100개 표시`, 100 desktop rows, no console warnings/errors.
- Region tabs: KR `87개 표시`, JP `77개 표시`, Global `83개 표시`, integrated `100개 표시`.
- Every tab wrote the expected `#tab=...` URL state and `aria-selected=true`.
- Integrated search `신아영`: one result; counterpart names show `신아영 / 下北愛梨 / Ah-yeong Shin`.
- Character ID 1 dialog opened with three locale records and three official links.
- Dialog close returned focus to the invoking `data-character-id="1"` result button.
- Search with `존재하지않는캐릭터XYZ`: zero rows and visible empty state; reset restored 100 results and default sort.

## Performance/robustness correction

The original pretty JSON was unsuitable for a constrained local browser fetch. `prepare-data.ps1` now generates a 63,510-byte minified browser bundle containing only the nine runtime fields, down from the 187,986-byte first embedded form. Full `characters.json` remains preserved for audit.

## Visual evidence

- `qa-desktop-1440.png`: unified summary surface.
- `qa-character-browser-1091.png`: controls, local thumbnails, and desktop table.

The implementation contains explicit 880/720/520 px breakpoints, hides the table and shows cards at 720 px, uses `min-width:0`, and disables document-level horizontal overflow. The Browser viewport override did not change the reclaimed local tab's measured 1091 px viewport in this run, so the independent QA lane is tasked with a second mobile check rather than treating the attempted override as proof.
