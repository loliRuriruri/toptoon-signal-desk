# Character browser component spec

## Overview
Searchable, sortable catalog of verified locale records.

## DOM Structure
`section.panel > heading + toolbar + result-status + table-wrap/table + card-list + empty-state`.

## Computed Styles
13 px table text, 10 px cells, 44 px rounded thumbnail, sticky headings, row hover/focus surface, source palette controls.

## States and Behaviors
Search names and works; select a work; sort views/chats/name/work; click or Enter/Space opens detail.

## Per-State Content
Unified mode shows one representative row per unique ID plus locale availability. Market modes show the market-native name/work/metrics.

## Assets
Local thumbnail for the representative or selected locale with text fallback if missing.

## Text Content
Search placeholder includes name/work; empty state offers `필터 초기화`.

## Responsive Behavior
Table at 721 px and above; semantic cards at 720 px and below. No document overflow.

## Original Implementation Inventory
Source toolbar, sticky table column, thumbnail/name row, sorting, search, and row-modal trigger.

## Parity Decision
Near-parity desktop table plus a new mobile card mode to repair the source's 390 px overflow.
