# GameDay — Design System & UI Standards

**Status: binding.** This document governs all UI built for the GameDay platform.
Treat it the way you treat the Working Agreement in the project brief: it is not a
suggestion. Any screen, component, or style that contradicts it is wrong and must be
corrected. It is derived from the project's own approved mockups (the ops, scoring,
teams, and accreditation demos), which are the source of truth for the visual language.

If you are an autonomous coding agent: read this before generating or restyling any UI.
Do not reach for framework defaults (stock Tailwind colours, system fonts, default
shadcn themes). The whole point of this file is that defaults are *not* the brand.

---

## 1. The core idea — one brand, two modes

GameDay has a single brand identity — **navy and gold, warm and editorial, Caribbean
but tournament-grade** — applied in two modes depending on the surface:

| Mode | Where it is used | Background |
|------|------------------|------------|
| **Console (light)** — the default | `teams`, `platform` (ops, review, accreditation), badge production, public `www` | Warm sand `#FAF7F0`, dark ink text |
| **Broadcast (dark)** | Live scoring control, on-screen overlays, broadcast/match views | Near-black `#0A0A12`, light ink text |

Both modes use the **same palette and the same fonts**. The mode changes only the
background/ink polarity. Navy and gold are constant across both.

**Default any administrative or data-entry surface to Console (light).** Only the live
scoring / broadcast surfaces are dark. Do not build the `teams` or `platform` surfaces
in dark mode — that contradicts the mockups.

---

## 2. Colour tokens

Define these as CSS custom properties at `:root` and reference them everywhere. Never
hardcode a hex value inline; never use a stock Tailwind colour (`indigo-600`, `gray-400`,
etc.) in place of a token.

### Brand (constant in both modes)

```css
--navy:        #1B2A6B;   /* primary brand, headings-on-light, buttons */
--navy-deep:   #0F1A4A;   /* topbars, badge headers */
--navy-soft:   #2D3F8E;   /* hover state for navy */
--gold:        #F4C430;   /* primary accent, the signature colour */
--gold-bright: #FFD93D;   /* accent-on-dark, small highlights */
--gold-deep:   #B8860B;   /* gold text on light, progress fills */
--coral:       #E8553D;   /* secondary accent / media category / alerts */
--teal:        #0E8C82;   /* technical category, secondary data accent */
--violet:      #6B4BA8;   /* broadcast category */
```

### Console mode (light) — ink + surfaces

```css
--ink:        #0E1230;   /* primary text */
--ink-soft:   #3D4163;   /* secondary text */
--ink-muted:  #6E7191;   /* labels, captions */
--ink-faded:  #A0A4B8;   /* disabled, fine print */
--bg:         #FAF7F0;   /* page background — warm sand, NOT white, NOT dark */
--bg-soft:    #F2EDDF;   /* table headers, inset fills */
--bg-sand:    #E8E0CC;   /* deeper inset */
--white:      #FFFFFF;   /* cards, panels */
--line:       rgba(14,18,48,0.08);   /* hairline borders */
--line-strong:rgba(14,18,48,0.16);   /* stronger borders, inputs */
```

### Broadcast mode (dark) — ink + surfaces

```css
--bg:       #0A0A12;   --bg2:     #10101C;
--surface:  #15151F;   --surface2:#1C1C29;   --card: #13131D;
--ink:      #F6F3EA;   --mute:    #9A9AAE;    --mute2:#62627A;
--line:     rgba(255,255,255,0.08);  --line2:rgba(255,255,255,0.16);
```

### Semantic (both modes)

```css
--ok:   #1E9E5A;   /* approved, verified, success */
--warn: #C9911A;   /* in progress, attention */
--bad:  #D8442C;   /* rejected, error, blocked */
```

---

## 3. Typography

Three faces, each with a fixed job. Load via `next/font/google` (preferred in Next.js)
or a Google Fonts link. **Never fall back to system-font-only** — the serif display face
is core to the brand and its absence is the single biggest "generic" tell.

```css
--font-display: 'Fraunces', Georgia, serif;        /* headings, names, stat numbers, brand */
--font-body:    'Manrope', system-ui, sans-serif;  /* all body copy, inputs, buttons */
--font-mono:    'JetBrains Mono', ui-monospace, monospace; /* labels, codes, IDs, meta */
```

For the **broadcast scoring** surface only, two additional high-impact display faces are
used for scores and big headers: `Anton` and `Archivo` (700/600 weights). Console
surfaces do not need these.

### Usage rules

- **Fraunces** (display serif): page titles, panel titles, person/team names, stat
  numbers, the brand wordmark. Weights 700–800. This is what makes it look editorial
  rather than generic. Use it for anything that should feel like a headline.
- **Manrope** (body sans): paragraphs, form fields, table cells, button labels, most UI
  text. Weight 400 for body, 600 for emphasis/buttons.
- **JetBrains Mono** (mono): small uppercase labels, country ISO codes, credential IDs,
  timestamps, metadata, status chips. Almost always uppercase with letter-spacing
  (`0.06em`–`0.16em`). This is a signature motif — small mono caps with tracking.

### Type scale (console)

| Role | Family | Size | Weight | Notes |
|------|--------|------|--------|-------|
| Page title (h1) | display | ~1.85rem | 700 | letter-spacing −0.01em, line-height ~1.06 |
| Panel title (h2) | display | ~1.12rem | 700 | |
| Stat number | display | ~2rem | 700 | colour `--navy` |
| Body | body | ~0.92rem | 400 | line-height 1.5 |
| Button / emphasis | body | ~0.84rem | 600 | |
| Label / meta | mono | ~0.66–0.72rem | 600–700 | UPPERCASE, letter-spacing 0.07–0.08em, colour `--ink-muted` |

---

## 4. Signature motifs

These recurring elements are what make a screen recognisably GameDay. Use them.

- **Navy topbar with a gold underline.** Sticky top bar in `--navy-deep`, white text,
  with a `3px solid var(--gold)` bottom border. Present on every authenticated surface
  and on badges (`border-bottom:3–4px solid var(--gold)`).
- **The brand mark.** A rounded square (`border-radius:7–8px`) filled with a
  `linear-gradient(135deg, var(--gold), var(--coral))`, containing the monogram in
  `--font-display`, `--navy-deep` text. Wordmark "GameDay" in Fraunces, with a small
  mono-caps tagline beneath in `--gold-bright`.
- **Small mono-caps labels with tracking** (see typography). Used for every field label,
  section kicker, and metadata line.
- **Cards lift on hover:** `transform: translateY(-3px)` + a soft shadow
  (`0 12px 28px rgba(14,18,48,0.10)`), border deepens to `--line-strong`. 150ms transition.
- **Rounded geometry:** cards/panels `border-radius:14–16px`; inputs/small elements
  `6–10px`. Nothing fully square, nothing pill-rounded except status chips and the MFA tag.

---

## 5. Components

### Buttons
- **Primary:** `background:var(--navy)`, white text; hover `var(--navy-soft)`. Used for
  the main action on a view (Submit, Approve, Save).
- **Accent / call-to-action (broadcast or high-emphasis):** `background:var(--gold)`,
  `color:var(--navy-deep)`, weight 800, uppercase. Used for score actions and primary
  publish actions.
- **Success confirm:** light green fill `#E2F6EC` with `--ok` text and a green hairline
  border; on hover invert to solid `--ok` with white text.
- Buttons are `border-radius:8–10px`, padded ~`0.55rem 0.95rem`, weight 600+.
- Never ship a flat stock-indigo Tailwind button. The primary is **navy**, not indigo.

### Cards & panels
- White (`--white`) on the sand background, `1px solid var(--line)`, `border-radius:14–16px`.
- Panels have a header row (`--line` bottom border) with a Fraunces title and an optional
  mono sub-label, then body content.

### Tables
- Header cells: `--bg-soft` fill, mono-caps labels, `0.66rem`, `--ink-muted`, weight 700,
  letter-spacing 0.08em.
- Body cells: `0.87rem`, `1px solid var(--line)` row separators, vertical-align middle.

### Status pills
- Small rounded pills with a coloured dot + label. Map to semantic colours:
  - in progress / draft → gold family on `#FEF6E0`
  - approved / verified → `--ok` on `#E2F6EC`
  - rejected / blocked → `--bad` on `#FBE6E2`
- Use these consistently for delegation status, review status, and submission state.

### Accreditation category colour-coding (important — keep consistent)
Each accreditation category has a fixed colour, used on badges, dropdowns, and matrices.
Do not invent new mappings:

| Category | Token / tint |
|----------|--------------|
| Player | gold — `rgba(244,196,48,0.18)` bg, `--gold-deep` text |
| Official | navy — `rgba(27,42,107,0.12)` bg, `--navy` text |
| Technical | teal — `rgba(14,140,130,0.14)` bg, `--teal` text |
| Media | coral — `rgba(232,85,61,0.14)` bg, `--coral` text |
| Broadcast | violet — `rgba(107,75,168,0.14)` bg, `--violet` text |
| VIP | ink/gold — `rgba(14,18,48,0.86)` bg, `--gold-bright` text |

### Badges (physical credentials)
- Navy-deep header with gold underline, event name in mono-caps gold, country-dominant
  theming, photo block, name in Fraunces, category band as a second read, QR, mono
  credential ID. Country colour leads; the category colour is the secondary signal.

---

## 6. Accessibility & contrast (this is a requirement, not a nicety)

The dark-mode form labels that prompted this document failed because fixed mid-grey was
used on a dark surface. Do not repeat that.

- **Body and label text must meet WCAG AA: ≥ 4.5:1** against its background. Form labels
  in particular must be clearly legible — use `--ink` or `--ink-soft` on light, `--ink`
  (`#F6F3EA`) or `--mute` (only where genuinely secondary) on dark. Never put `--ink-faded`
  / `--mute2` on a primary label.
- Do not use a single fixed grey across both modes. Labels must use the mode's ink token.
- Interactive targets ≥ 40px tall. Focus states must be visible (a `--gold` or `--navy`
  ring), never removed.
- Never rely on colour alone to convey status — pair the colour with text or an icon
  (the status pills already do this with a label).

---

## 7. UI voice & communication standards

Copy in the interface follows the same standards as the platform's documents: clear,
professional, Caribbean-context-aware, never breathless or gimmicky.

- Plain, direct, confident. "Submit delegation for review", not "Let's get you submitted!".
- No exclamation marks in system copy; no emoji in the product UI.
- Labels are nouns; buttons are verbs. Consistent terminology with the accreditation
  matrix and the brief (delegation, roster, credential, accreditation, official).
- Validation and error messages state what is wrong and what to do, neutrally — e.g.
  "Guardian consent is required before this delegation can be submitted." Not blame, not
  jargon.
- Dates and identifiers in mono. Country names full; ISO codes in mono-caps.

---

## 8. Implementation notes

- Put the tokens in a single global stylesheet (`globals.css`) as `:root` custom
  properties, and a `[data-mode="broadcast"]` (or equivalent) override block for the dark
  surfaces. Reference tokens via `var(--…)` — or, if extending Tailwind, map them into
  `theme.extend.colors` so utilities resolve to brand tokens rather than stock palette.
- Load the three fonts via `next/font/google` and expose them as CSS variables
  (`--font-display`, etc.) so they apply consistently and self-host for performance.
- **Do not** restyle by sprinkling stock Tailwind colour utilities. If a colour is needed,
  it comes from a token. A quick self-check before shipping any view: *are there any
  `indigo-*`, `slate-*`, `gray-*` Tailwind classes, or any system-font headings? If yes,
  it is off-brand — replace with tokens and Fraunces.*

---

## 9. Hard "do not" list

1. Do not use stock Tailwind/shadcn default themes or palette utilities as brand colours.
2. Do not build admin/registration surfaces (`teams`, `platform`) in dark mode — they are
   Console (light, warm sand).
3. Do not omit the display serif — headings without Fraunces read as generic.
4. Do not put low-contrast grey on form labels in either mode.
5. Do not invent new category colours — use the fixed mapping in §5.
6. Do not use emoji or exclamation marks in product copy.
7. Do not hardcode hex values inline — reference tokens.

When in doubt, open the approved mockups (ops / scoring / teams / accreditation) and match
them. They are the reference; this document is their written form.
