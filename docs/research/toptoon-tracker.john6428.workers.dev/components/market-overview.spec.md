# Market overview component spec

## Overview
Snapshot-level totals and a compact comparative visualization.

## DOM Structure
`section.panel > heading + stats-grid + chart-area`; chart uses accessible HTML bars and a textual legend rather than opaque canvas-only information.

## Computed Styles
Panel `#151822`, raised cards `#1c202c`, 12 px/8 px radii, 1 px `#2a2f3d` borders.

## States and Behaviors
Recomputes from the active locale. Unified mode compares counts and totals by market; locale mode ranks the top ten characters by views.

## Per-State Content
Stats: characters, views, chats, works. Unified mode also states 100 unique IDs and 65 IDs present in all markets.

## Assets
No raster assets.

## Text Content
`시장 스냅샷`, locale legend labels, compact-number totals, snapshot caveat.

## Responsive Behavior
Four columns desktop, two tablet, one mobile; bar labels wrap safely.

## Original Implementation Inventory
Source stat cards and chart panels are retained; unavailable timeseries and revenue claims are omitted.

## Parity Decision
Approved reimplementation using accessible DOM bars because the collected data is a current snapshot, not a time series.
