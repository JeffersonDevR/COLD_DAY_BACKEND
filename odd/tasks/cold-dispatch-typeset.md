# Cold Dispatch — typeset pass

Objective: put the web app's typography onto the Cold Dispatch scale defined in `DESIGN.md`, with no colour or layout change.

Problem: the web app has no role scale. It mixes 11 distinct sizes (9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36 px), 122 declarations below the 12 px floor, 74 weights above the 700 ceiling, and two font assets — one of which is downloaded and never referenced.

Why now: `DESIGN.md` (Cold Dispatch) is the written authority and `typeset` is step 3 of the migration sequence. Every later step (clarify, adapt, audit) reads this scale.

## Scope

Authorized: `frontend/src` only.

- `frontend/src/styles.css` — theme tokens and base type rules.
- `frontend/src/index.html` — font delivery.
- `frontend/src/app/**/*.html` — class-level type migration.

Out of scope: colours, layout, spacing, `frontend/projects/mobile`, `landing/`, backend.

## Type system (normative, from DESIGN.md)

| Role | Size | Line height | Tracking | Face |
|---|---|---|---|---|
| display | 32px | 1.1 | −0.02em | Space Grotesk 700 |
| headline | 24px | 1.2 | −0.01em | Space Grotesk 700 |
| title | 16px | 1.4 | 0 | Inter 600 |
| body | 14px | 1.5 | 0 | Inter 400 |
| label | 12px | 1.3 | 0.02em | Inter 600 |

Floor: nothing below 12px. Ceiling: nothing above 700.

## Tasks

- [x] **T1** — Defined the scale in `styles.css` via the Tailwind v4 `--text-*` theme namespace; set `--font-sans`, `--font-display`, `--font-mono`; applied the display face to `h1`–`h3` and balanced/pretty wrapping. Route: inline (mechanical, already understood).
- [x] **T2** — Replaced the unused Plus Jakarta Sans download with Inter + Space Grotesk + Space Mono, `display=swap`. Route: inline (one mechanical file).
- [x] **T3** — Migrated 34 of 40 templates: 122 sub-floor sizes, 74 heavy weights, 94 large sizes, 24 role judgments, 23 `font-display` additions, 3 SVG sizes. Route: delegated writer (41 declared, 40 on disk).
- [x] **T4** — Verified: `ng build` exit 0, zero floor/ceiling violations remaining.
- [x] **T5** — Mechanical type scan returns `[]`.

## Acceptance criteria

- Zero `text-[9px]`, `text-[10px]`, `text-[11px]` remain.
- Zero `font-black` / `font-extrabold` remain.
- No `Plus Jakarta Sans` reference remains; Space Grotesk, Inter, and Space Mono are all requested.
- `text-display`, `text-headline`, `text-title`, `text-label` resolve to the table above.
- `ng build` succeeds; no template compile error.

## Checks

- `cd frontend && npm run build`
- `impeccable detect --json --scope type src`

## Progress

Complete. Evidence:

**T1** — `.text-display`, `.text-headline`, `.text-title`, `.text-label`, `.font-display` all present in `dist/app/browser/styles-SNF2BHR4.css`. Resolved values:
```
.text-display { font-size: var(--text-display); line-height: var(--text-display--line-height);
                letter-spacing: var(--text-display--letter-spacing); font-weight: var(--text-display--font-weight) }
h1,h2,h3 { font-family: var(--font-display); text-wrap: balance }
```

**T2** — `index.html` now requests `Inter:wght@400;500;600;700`, `Space+Grotesk:wght@500;600;700`, `Space+Mono:wght@400;700`. Zero `Plus Jakarta` references remain in `src`.

**T3** — Substitution counts from the delegated writer, independently re-verified: A 122, B 74, C 94, D 24 (14 headline / 10 title), F 5 dedupes, G 23, H 3.

**T4** — `npm run build` completes; only the pre-existing `NG8102` warning on `diagnostico-ot-page.html:97` remains (untouched by this pass). `git diff --stat -- src` = 318 insertions / 656 deletions across 38 files, of which the non-typographic bulk is pre-existing work in `solicitar-servicio-page.{html,ts,spec.ts}`.

**T5** — `impeccable detect --json --scope type src` → `[]`. Full scan returns two pre-existing findings, both outside this pass: `text-purple-600` on a heading in `disputas-admin-page`, and an `<img>` with no `src` in `seguimiento-ot-page`.

**Deviations**
- Rule G excluded 24 PrimeIcons glyph `<i>` elements. `.pi` sets `font-family: primeicons`; adding `font-display` there would be dead at best and icon-breaking at worst. Verified 0 non-icon elements carry `text-display`/`text-headline` without `font-display`.
- Two `[class]` binding strings (`empty-state`, `historial-equipos-page`) carried `text-3xl`/`text-2xl` as expression literals rather than class tokens. Both normalized to `text-2xl` (24px icon size), closing the last off-scale size.
- `text-xs`, `text-sm`, `text-base` were deliberately left alone: they already sit at 12 / 14 / 16, three steps of the scale. Renaming 715 occurrences would have produced a large diff with no render change.

## Next step

`clarify` — copy pass, then `adapt`. Colour migration (the Dark Ops palette) is still unstarted and is the largest remaining divergence from `DESIGN.md`.
