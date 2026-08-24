# App shell component spec

## Overview
Sticky dark header and the region-level navigation for the integrated tracker.

## DOM Structure
`header > title-group + nav[aria-label] > four buttons`; followed by `main` and a small footer note.

## Computed Styles
Background `#0b0d12`; header bottom border `#2a2f3d`; maximum content width 1400 px; active tab `#3987e5`; 8 px control radius.

## States and Behaviors
Four mutually exclusive tabs: all, KR, JP, Global. Click and keyboard activation update the dashboard and URL hash.

## Per-State Content
통합 uses Korean labels and combined totals. Locale tabs retain the same controls while switching the underlying records and accent label.

## Assets
None.

## Text Content
Title `TOPTOON CHAT TRACKER`; subtitle identifies the three-region snapshot and collection date.

## Responsive Behavior
Tabs form a horizontally scrollable strip below 640 px while the page itself remains within viewport width.

## Original Implementation Inventory
Source sticky header, toolbar, and pill-like tab buttons are retained conceptually.

## Parity Decision
Approved reimplementation: replace the source's product-area tabs with the user-requested region tabs while preserving visual tokens and sticky behavior.
