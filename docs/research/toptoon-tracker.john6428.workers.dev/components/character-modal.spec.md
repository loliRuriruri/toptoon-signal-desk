# Character modal component spec

## Overview
Accessible character details with cross-locale mapping.

## DOM Structure
Native `dialog > close button + hero + metrics + locale-list + links`.

## Computed Styles
Maximum 760 px, dark raised surface, 12 px radius, 128 px thumbnail, backdrop rgba black 0.7.

## States and Behaviors
Opens from a result; Escape/backdrop/close dismisses; return focus to opener. Locale source links open in a new tab with safe rel attributes.

## Per-State Content
Selected record is primary. Every locale sharing the character ID displays its verified name, work, and market link.

## Assets
Selected record's local thumbnail; no remote request is required for display.

## Text Content
Name, work, views, chats, character ID, locale availability, `공식 캐릭터 페이지` links.

## Responsive Behavior
Hero becomes stacked under 520 px; dialog uses safe viewport margins and scrolls internally.

## Original Implementation Inventory
Source overlay, close button, detail fields, and detail link.

## Parity Decision
Approved native-dialog reimplementation for keyboard focus and escape behavior while retaining the source layout and dark styling.
