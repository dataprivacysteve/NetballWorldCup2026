# Brand assets (official logos)

Official federation / event logos go here. Served at `/brand/<file>`.

- **`event-logo.svg`** — the primary nav logo. Wired in `app/components/Header.tsx`
  via `brand.logoSrc` in `app/lib/config.ts`; replaces the text wordmark when
  present, falls back to text if missing.
- Add other supplied marks (e.g. `world-netball.svg`, sponsor lockups) here and
  reference them by path where needed.
- **SVG preferred**; transparent PNG is fine. Keep the official files unmodified
  and respect the federation's brand/usage guidelines.
