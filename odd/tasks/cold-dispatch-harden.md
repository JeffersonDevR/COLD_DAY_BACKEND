# Cold Dispatch — hardening pass (`harden`)

Objective: close the P1/P2 findings from `odd/audits/2026-11-09-cold-dispatch-audit.md` that affect whether a real user can finish a task or trust the screen.

## Findings in scope

| # | Finding | Severity |
|---|---|---|
| H1 | Login shows a fabricated `4.9★ Reputación media` as evidence | P1 |
| H2 | `liquidaciones-tecnico` swallows its load error and renders "Todavía no hay liquidaciones" on a backend outage | P2 |
| H3 | Sidebar overlays close by click only — no Escape, no focus return | P2 |
| H4 | `<img>` bound to a possibly-empty URL renders a broken-image box | P2 |
| H5 | Inline icon style in `consignaciones-admin` | P3 |

## Tasks

- [ ] **H1** — Delete the `4.9★ / Reputación media` tile from the login mini-metrics and change the grid from `grid-cols-3` to `grid-cols-2`. The other two tiles (90 days warranty, 10 km radius) are factual and stay. Do not replace it with another invented figure.
- [ ] **H2** — Add an `errorCarga` signal to `LiquidacionesTecnicoPage`; set it in the `error` callback instead of silently emptying the list; render `<app-carga-error>` with the page's retry path, as the other boards do. The empty state must only show when the call actually succeeded. Distinguish "failed" from "nothing to do" in the copy.
- [ ] **H3** — In `AppSidebar`: Escape closes any open overlay; when overlays close, focus returns to the visible menu toggle. Add `data-menu-toggle` to the topbar's two toggle buttons and focus the first visible one. No focus trap this pass — that is a larger modal change.
- [ ] **H4** — In `seguimiento-ot`, only render the evidence `<img>` when its URL is non-empty (`@if (url)` inside the `@for`), and add `loading="lazy"`.
- [ ] **H5** — Replace the inline `style="font-size: 14px; width:14px; height:14px"` with a scale class.

## Also check (report, fix only if trivially safe)

- Long text: a client name or address of 100+ characters inside the adapted tables and cards. Prefer `min-w-0` + `truncate` on flex children over fixed widths.
- Currency: amounts must render through one formatting path; report any place a peso amount is interpolated raw.

## Constraints

- No new dependency.
- Do not reflow or reformat unrelated lines.
- Preserve UTF-8.
- Do not re-add `dark:` tokens.
- Do not touch `landing/` or `frontend/projects/mobile`.

## Verification

- `npm run build`
- `npx ng test --watch=false --project app`
- Report: does any test assert the removed `4.9` text?

## Progress

Complete.

**H1** — Login mini-metrics: the `4.9★ Reputación media` tile is deleted and the grid is `grid-cols-2`. Verified visually at 1440 px: two tiles, "90 / Días de garantía" and "10 km / Radio de búsqueda", no invented figure.

**H2** — `liquidaciones-tecnico` now has `errorCarga`, sets it on failure, and renders `<app-carga-error>` with `reintentarCarga()`. The empty state renders only after a successful response, so an outage no longer reads as "nothing to do".

**H3** — Escape closes any open overlay via an Angular host listener; masks now route through the same handler, so click-close also restores focus. Focus returns to the first *visible* `[data-menu-toggle]`.

Note on the toggle lookup: in PrimeNG 21 `<p-button>` is the host custom element and the real `<button>` lives inside its template, so a plain attribute on `<p-button>` never reaches a focusable node. The component uses `[pt]="ptToggleMenu"` to project `data-menu-toggle="true"` onto the inner button. Verified: exactly two `BUTTON` elements carry the attribute.

**H4** — The evidence `<img>` renders only when its URL is non-empty and now lazy-loads.

**H5** — Inline icon style removed, and the other 14 `style="font-size…"` occurrences normalized to scale classes (the verification demanded zero). Remaining inline `font-size` in templates: **0**.

**Found while in there, and fixed**
- Two more fabricated `4.9` fallbacks of the same class: `seguimiento-ot`'s technician chip (`tecnicoReputacion || 4.9`) and `panel-tecnico`'s KPI (`|| 4.9` → `—`).

**Found and reported, not fixed**
- `panel-tecnico` still claims **"Tasa de éxito 98%"** and **"12 reseñas verificadas"** with no data behind them. Same defect class as H1, larger scope, belongs to a content decision.
- `mapa-radar.ts` and `mock-db.service.ts` contain demo rating fixtures. Those are data, not presentation fallbacks.

**Long text**
No layout engine is available (no Playwright; jsdom has no layout), so this was code-path analysis. Auto-layout tables wrap text with spaces and scroll inside their wrapper when a token cannot break. Flex children were the real risk — `min-width: auto` — so `min-w-0 truncate` + `title` was applied to the address/client lines in `seguimiento-ot`, `ejecucion-ot`, `ofertas`, `panel-tecnico`, and to the `disputas` two-column grid.

**Currency**
Every peso amount in a template goes through `toLocaleString('es-CO')`. The dashboard's `M`/`K` KPI tiles are deliberate magnitude abbreviations. No raw interpolation found; no change made.

**Verification**
- `npm run build` → complete, exit 0.
- `npx ng test --watch=false --project app` → 84 files, 893 tests.
- `4.9` → 0 occurrences in templates and specs. (`Reputación` remains only where a real `reputacion` field is `@if`-guarded.)
- `style="font-size` → 0.

**Housekeeping**
The delegated agent wrote `odd/build-output.txt` and `odd/test-output.txt` into the repo; both removed.
