# Behaviors

## Source behaviors observed

- Sticky header tabs switch between Main, DC Gallery, and Global Entry without navigation.
- Character search filters the live table; `신아영` produces one result.
- Sort controls reorder the character table.
- Clicking a row opens an overlay dialog with character details and a source link.
- Canvas charts are static until pointer hover, which reveals a tooltip.
- No timed animation was found.
- At 390 px the source document is 653 px wide, causing horizontal page overflow.

## Rebuild behaviors

- Region tabs filter the whole dashboard to 통합, KR, JP, or Global and update URL hash/state.
- Search matches character names, localized counterparts, and work titles across scripts.
- Work filter is derived from the active tab's records.
- Sort supports views, chats, name, and work.
- Clicking or keyboard-activating a result opens the character dialog.
- Escape, the close button, or clicking the backdrop closes the dialog; focus returns to the opener.
- The dialog lists only verified locales for the character ID.
- Desktop uses a table; mobile switches to cards without page-level horizontal overflow.
- Empty search results show a clear reset action.
- All displayed metrics derive from the included snapshot; no live-update claim is made.
