# Cold Dispatch — polish pass

Objective: close the remaining audit findings. Refinement only — no redesign, no new components, no copy invention.

## Items

**P1-1 Radar colour drift.** `shared/mapa-radar/mapa-radar.html` carries 36 hard-coded hex values from the pre-migration sky palette. They survived the palette pass because SVG presentation attributes are invisible to a class-based migration.

| Current | Token | Tailwind |
|---|---|---|
| `#38bdf8` ×8 | signal | `fill-signal` / `stroke-signal` |
| `#0ea5e9` ×4 | signal | same |
| `#0284c7` ×4 | signal-hover | `fill-signal-hover` |
| `#0369a1` | signal pressed | `var(--color-signal-pressed)` |
| `#0f172a` | canvas | `var(--color-canvas)` |
| `#64748b` | ink-muted | `fill-ink-muted` |
| `#475569` | ink-muted | `fill-ink-muted` |
| `#10b981` | success | `fill-success` |
| `#ffffff` (dot stroke) | canvas — a cut-out ring, not white | `stroke-canvas` |
| `#334155`, `#1e293b`, `#cbd5e1`, `#22d3ee` | already correct | leave |

Mechanism:
- Presentational attributes that are static → move to Tailwind classes (`fill-*`, `stroke-*`). Tailwind v4 generates these from the `@theme` colour tokens.
- `<stop stop-color="…">` has no utility → use `style="stop-color: var(--color-x)"`.
- Ternary bindings like `[attr.fill]="cond ? '#10b981' : '#64748b'"` cannot take `var()` in an attribute. Convert to a class binding: static `class="fill-ink-muted"` plus `[class.fill-success]="cond"`. Verify the resulting order actually wins at runtime; if both classes apply, use `[class]` with a computed string instead.

**P1-2 Radar labels fail the floor and contrast.** `font-size="9"` ×4 with `fill="#475569"` (2.5:1), and `fill="#64748b"` on the km labels (3.9:1). Raise every `font-size` to **12** and the fills to `fill-ink-muted` (6.71:1). `font-family="monospace"` on data labels → `font-family: 'Space Mono', ui-monospace, monospace` via `style` or a `font-mono` class.

**P1-3 No reduced-motion path.** The app has zero `prefers-reduced-motion` rules against 9 continuous decorative animations. Add to `src/styles.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-ping, .animate-pulse, .animate-bounce, .animate-radar { animation: none; }
  .animate-spin { animation-duration: 2s; }
  .transition-all, .transition-transform { transition-duration: 0.01ms; }
}
```

Keep the spinner moving — it communicates loading and must not disappear. Do **not** apply a global `*` kill.

**P1-4 SVG accessible names.** Both dashboard charts (`dashboard-admin-page.html:113,178`) and both radars (`mapa-radar.html:187,219`) need `role="img"` and a `<title>` as the first child. Title text names what the graphic shows; where the number is meaningful, include it in the title. Decorative-only SVG gets `aria-hidden="true"` instead.

**P1-5 Unnamed close button.** `liquidaciones-tecnico-page.html:70` — add `aria-label="Cerrar"` (or better: what it closes, e.g. `"Cerrar legalización"`).

**P3-1 `preserveAspectRatio="none"`** on the dashboard bar chart distorts strokes and text at wide viewports. Remove it or set `xMidYMid meet`.

**Content: two more invented metrics.** `panel-tecnico-page.html` shows `Tasa de éxito 98%` and `12 reseñas verificadas` with no data behind them. Same defect the `4.9` had. Resolve the way a missing value is already resolved elsewhere on that page: render the real field when it exists, otherwise `—`. Do not invent a replacement number.

## Constraints

- No new dependency, no redesign, no copy invention.
- Do not reflow unrelated lines. Preserve UTF-8. No `dark:` tokens.
- `mapa-radar.html` is large; change attributes only, never structure.

## Verification

- `npm run build`, `npx ng test --watch=false --project app`.
- `impeccable detect --json src` — report the findings.
- Grep `mapa-radar.html` for `#[0-9a-fA-F]{6}` — only permitted values are ones already matching a token; report any that remain.
- Grep for `font-size="9"` — must be 0.

## Progress

Complete.

**P1-1 / P1-2 — radar tokens.** 36 hard-coded hex values → **4**, all exact token matches (`#334155` ×2, `#22d3ee` ×2). Static attributes moved to `fill-*` / `stroke-*` classes; `<stop stop-color>` to `var(--color-*)`; ternary attribute bindings converted to static class + `[class.x]`. Every `font-size="9"` is now `12`.

`fill-success` did not exist — Tailwind has no default `success` colour — so `--color-success` was added to `@theme`. It was initially dropped inside the signal ramp; it now sits in a proper semantic group with `warning`, `danger`, and `tertiary`, matching the palette `DESIGN.md` already declares.

**P1-3 — reduced motion.** The block landed in `styles.css` **and** in `mapa-radar.css`, because the radar's animation lives in a component stylesheet that Angular compiles to `[_ngcontent]` specificity (0,2,0); a global 0,1,0 rule loses and the sweep kept turning. The class is `animate-radar-spin`, not `animate-radar`.

**P1-4 — accessible names.** Both charts got `role="img"` + `<title>`; the vector radar got a title naming the count and radius. The Google Maps overlay cone got `aria-hidden="true"` instead — it is `pointer-events-none` and carries no data.

**P1-5 —** close button now `aria-label="Cerrar legalización"`.

**P3-1 —** `preserveAspectRatio="none"` removed; 0 remain.

**Content.** `Tasa de éxito 98%` → `—` (and its ink from `text-emerald-400` to `text-ink-muted`, because green asserts settled work on an unknown value). `12 reseñas verificadas` → `— reseñas verificadas`. No aggregate field exists in the API; the backend stores ratings per order, never a count or success rate.

**Correction to the audit.** Its P2 "broken image — `<img>` with no `src`" was a **static false positive**: the element carries `[src]="url"`, which the detector cannot see. The real defect was that an empty string inside `evidenciaUrls` would render a broken box; that is what `@if (url)` fixes.

**Verification**
- `npm run build` → complete, exit 0.
- `npx ng test --watch=false --project app` → 84 files, 893 tests.
- Detector: 3 findings, all accounted for — `ai-color-palette` (committed decision: violet owns disputes), `broken-image` (false positive, binding invisible to the scanner), `bounce-easing` advisory (`animate-bounce` is used once in `seguimiento-ot-page.html:41`, so the reduced-motion selector is correct).

**Known limitation**
`font-size="12"` inside the SVG is 12 *viewBox units*. At the 360 px container ceiling over a 400-unit viewBox the scale is ~0.9, so radar labels render at roughly 10.8 CSS px — close to the floor, not at it. Reaching a true 12 CSS px means changing the viewBox or the container width, which is structural, not polish.
