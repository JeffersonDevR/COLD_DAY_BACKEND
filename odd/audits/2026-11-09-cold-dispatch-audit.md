# Audit — COLD DAY web app (Cold Dispatch)

Date: 2026-11-09. Scope: `frontend/src`. Method: source sweep + bundled detector + computed contrast matrix. No fixes applied — findings are for `harden` and `polish`.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 2/4 | Continuous animation ignores `prefers-reduced-motion` (SC 2.2.2); four SVG charts/radars have no accessible name (SC 1.1.1) |
| 2 | Performance | 3/4 | 283 KB initial bundle, lazy routes; two full-screen `backdrop-blur` masks are the heaviest paint |
| 3 | Theming | 3/4 | Token system complete, but the radar still paints 36 pre-migration hex values |
| 4 | Responsive Design | 3/4 | Boards adapted to 3/6/8 columns; residual 360 px overflow unverified |
| 5 | Implementation Integrity | 3/4 | Coherent and specific; two detector findings, one a committed decision, one real |
| **Total** | | **14/20** | **Good** |

## Implementation Integrity verdict

**Pass.** The implementation now expresses a single, product-specific system: one dark appearance, five type roles, a semantic colour vocabulary (`canvas/surface/well/hairline/signal/ink-*`), and one shared label layer for backend enums. The detector's `ai-color-palette` warning on `disputas-admin-page` is a false positive: violet is the committed colour for dispute mediation and the heading measures 7.5:1.

## Findings

### P0
None.

### P1

**Radar labels fail contrast and the type floor** — `shared/mapa-radar/mapa-radar.html:239,243,262–265,275`
`fill="#475569"` on neighbourhood labels at `font-size="9"` measures **2.5:1** and sits below the 12 px floor; `fill="#64748b"` on the km labels measures **3.9:1**. Both are explicitly banned in `DESIGN.md`. The technician waiting for work reads this screen most. → `/impeccable polish`

**Radar still paints the pre-migration palette** — same file
36 hard-coded hex values, including `#38bdf8` ×8, `#0ea5e9` ×4, `#0284c7` ×4. These are SVG presentation attributes, so the class-based palette migration could not reach them. The radar reads old blue inside a cyan system. → `/impeccable polish`

**Continuous animation with no reduced-motion path** — app-wide
`animate-ping` ×5, `animate-pulse` ×2, `animate-radar` ×2, `animate-bounce` ×1. Zero `prefers-reduced-motion` rules in the web app. Indefinite decorative motion that cannot be paused violates SC 2.2.2 (Level A). `animate-spin` ×13 is a loading indicator and is exempt in practice. → `/impeccable animate`

**Charts and radars have no accessible name** — `dashboard-admin-page.html:113,178`, `mapa-radar.html:187,219`
Both SVGs lack `role="img"` and a `<title>`. Legends exist nearby, which mitigates but does not satisfy SC 1.1.1. → `/impeccable polish`

**Icon-only button without an accessible name** — `liquidaciones-tecnico-page.html:70`
`<button (click)="liqSeleccionada.set(null)">` containing only `<i class="pi pi-times">`. No `aria-label`, no focus style. SC 4.1.2. → `/impeccable polish`

**Fabricated metric on the login page**
`4.9★ Reputación media` is presented as evidence with no data behind it, on the first screen every user sees. → `/impeccable harden`

### P2

**Overlay masks close by click only** — `app-sidebar.html:54,61`. No Escape handler, no focus return, no focus containment. Keyboard users can open the mobile drawer and cannot leave it without tabbing through the whole menu.

**Clickable table row without keyboard affordance** — `monitoreo-ot-page.html:95`. Mitigated: the in-row anchor remains the keyboard path.

**Broken image** — `seguimiento-ot-page.html`, `<img>` with no `src`. Renders as a broken-image box.

> **Correction (2026-11-09, polish pass):** this was a static false positive. The element carries `[src]="url"`, which the detector cannot read. The genuine risk was an empty string inside `evidenciaUrls` rendering a broken box; the element is now wrapped in `@if (url)` and lazy-loads. No action remains.

**Silent API failure** — `liquidaciones-tecnico-page.ts` swallows the load error, so a backend outage renders "Todavía no hay liquidaciones" instead of an error state. An operator reads it as "nothing to do".

**Leftover inline icon style** — `consignaciones-admin-page.html:164` still carries `style="font-size:14px; width:14px; height:14px"`.

### P3

`preserveAspectRatio="none"` on the bar chart distorts text and strokes at wide viewports.

## Measured positives

- **Contrast: 31 of 32 token pairs pass.** Full matrix: ink-primary 16.45 on surface, ink-body 13.96, ink-label 11.59, ink-muted 6.71, signal 9.52, signal-hover 7.09; semantic inks on their tints 8.01–9.80. The single failure is white-on-signal at **1.81**, and it is structurally prevented — that pairing uses `text-on-signal` (8.01).
- **All 107 buttons carry `type`** — no accidental form submissions.
- **Zero inline style colour declarations.**
- **All 13 files using `outline-none` pair it with an explicit focus replacement.**
- Column priority, sticky headers and whole-row links verified in the adapt pass.

## Recommended actions

1. **[P1] `/impeccable polish`** — radar labels to design tokens at 12 px, and the 36 legacy hex values in the radar SVG.
2. **[P1] `/impeccable animate`** — `prefers-reduced-motion` for ping/pulse/radar/bounce; keep the spinner.
3. **[P1] `/impeccable polish`** — `role="img"` + `<title>` on both charts and both radars; `aria-label` on the close button.
4. **[P1] `/impeccable harden`** — remove the fabricated `4.9`, surface the liquidaciones load error, add Escape and focus return to the drawer, fix the broken image.
5. **[P3] `/impeccable polish`** — preserveAspectRatio, leftover inline style.
