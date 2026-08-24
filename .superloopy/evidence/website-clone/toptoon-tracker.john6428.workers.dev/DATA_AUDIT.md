# Dataset audit — 2026-08-24 snapshot

| Site | Records | Unique works | Views | Chats | Missing names | Missing images |
|---|---:|---:|---:|---:|---:|---:|
| KR | 87 | 46 | 51,120,646 | 1,503,835 | 0 | 0 |
| JP | 77 | 42 | 60,581,411 | 219,587 | 0 | 0 |
| GLOBAL | 83 | 42 non-empty | 311,576 | 16,175 | 0 | 0 |

- 247 locale records across 100 unique character IDs.
- 65 character IDs are present in all three markets.
- No duplicate character ID exists within a market.
- All 247 local image references are present in the staged asset folders.
- One Global row has an empty work title; the UI must render an explicit fallback and exclude the empty value from the work filter.
