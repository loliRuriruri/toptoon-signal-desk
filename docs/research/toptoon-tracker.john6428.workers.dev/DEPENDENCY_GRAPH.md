# Dependency graph

```text
characters_combined.json ─┬─> app.js state ─> tabs/stats/chart
                          ├─> filters/sort ─> table/cards
                          └─> character ID grouping ─> detail dialog

assets/{kr,jp,global} ────────────────> row/card/dialog thumbnails
index.html ──> styles.css
index.html ──> app.js ──fetch──> data/characters.json
```

Runtime dependency policy: zero third-party packages. The site is plain HTML, CSS, and JavaScript and must be served over HTTP so the dataset can be fetched. A small PowerShell script stages the verified data and assets.
