STATUS: DONE

FINDINGS: none. The prior medium finding is resolved: `readHash()` now reads the legacy `tab` hash into `legacyMarket`, keeps it as the market fallback, and when no explicit `view` is present sets `state.view = "characters"` for valid legacy market values. This preserves old catalog URLs such as `#tab=global&q=Alice` while keeping the new statistics default for URLs without a legacy tab.

SPEC_ALIGNMENT: Aligned for the reviewed finding. The Taiwan/statistics extension still defaults to the statistics view, while legacy KR/JP/Global character URLs remain addressable through the compatibility path.

TEST_EVIDENCE: Reviewed the updated `app.js:229-237` legacy hash handling. Ran `node scripts/validate.mjs` -> pass: `Validation passed: four-market data/assets, statistics snapshot, DOM/style markers, and JavaScript syntax are OK.` Also accepted the parent-provided in-app Browser verification for this exact regression path: `#tab=global&q=Alice` shows the character view, Global selected, query retained, and 2 results.

RISKS: No remaining risk specific to the reviewed legacy-hash finding.

RECOMMENDATION: APPROVE

SUPERLOOPY_EVIDENCE: .superloopy/sessions/taiwan/evidence/website-clone/toptoon-tracker.john6428.workers.dev/ZORO_REVIEW.md
