# Navigator verdict: Taiwan public surface

STATUS: PASS

- `GET https://chat.toptoon.net/api/characters?limit=100` returned `success=true`, total 81, one page on 2026-08-24.
- Public records expose stable numeric IDs, Traditional Chinese character names, sorted hashtags, public counters, and a portrait thumbnail URL.
- IDs align with the other Toptoon Chat locales. Examples observed in the rendered DOM: 1, 61, 62, 76, 133, 221, 303.
- Detail route pattern is `/detail/character/{id}`.
- Detail character 61 used the same thumbnail asset for compact and hero views. Browser natural size was 832 x 1216 at the large variant; the visible crop came from `object-fit: cover`, not from a missing full-image endpoint.
- Public album images were blurred/locked and are out of scope. Only public catalog thumbnails are collected.
- Integration contract: site=`TW`, locale=`zh-TW`, market key=`tw`, local assets under `assets/tw`, work label from the first sorted hashtag.

Recommendation: use the locally downloaded original portrait in a responsive `object-fit: contain` dialog and keep the official detail page as the outbound link.
