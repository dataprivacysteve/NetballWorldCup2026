# Photography (editorial images)

Event/action photos go here (served at `/photos/<file>`), kept separate from
the official logos/marks in `../brand/`.

- **`hero.jpg`** — the big hero background (e.g. players jumping). Wired via
  `hero.image` in `app/lib/config.ts`; shows behind the dark scrim, with the
  gradient as a fallback if the file is missing.
  - Use a **wide, landscape** image (~1600–2000px), compressed **JPG or WebP**
    (aim < ~400 KB). The scrim darkens the left side, so keep faces/action
    toward the **centre-right** for legibility under the headline.
- Drop other editorial images here (watch thumbnail, news cards) and reference
  them by `/photos/<file>` where needed — ask and I'll wire those slots too.
