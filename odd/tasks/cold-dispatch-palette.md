# Cold Dispatch — palette migration

Objective: put the web app's colour onto the Cold Dispatch dark palette defined in `DESIGN.md`, without touching layout, typography, or behaviour.

Problem: the web app rendered a light royal-blue/sky world — `bg-white` cards, `slate-*` structure, `sky-600` accent — while the mobile app shipped the intended dark console. 2 470 colour tokens were spread over 40 templates, plus 902 inert `dark:` variants left from a theme toggle that no longer exists.

Why now: `typeset` finished the type scale, so colour is the last thing keeping the two surfaces from reading as one product.

## Scope

Authorized: `frontend/src`.

- `frontend/src/styles.css` — palette tokens and legacy ramp remap.
- `frontend/src/app/app.config.ts` — PrimeNG preset and dark selector.
- `frontend/src/index.html` — the dark-mode attribute.
- `frontend/src/app/**/*.html` and two TypeScript template strings.

Out of scope: `landing/`, `frontend/projects/mobile`, backend, and the deletion of the inert `dark:` tokens.

## Strategy

The incumbent used `slate-*` and `sky-*` semantically (light surface / dark ink), so re-pointing those two ramps inverts the whole app without rewriting every token. Only the steps that serve two roles at once — `slate-100`, `slate-700…950`, used as both fill and ink — needed explicit class rewrites.

## Tasks

- [x] **P1** — Add semantic palette tokens (`canvas`, `surface`, `surface-elevated`, `well`, `hairline`, `signal`, `ink-*`) and re-point the `slate`/`sky` ramps. Route: inline.
- [x] **P2** — Switch PrimeNG to the Cold Dispatch preset with a dark surface ramp and cyan primary; select dark through `[data-cd-dark]` rather than `.dark`, so the legacy Tailwind `dark:` variants stay inert. Route: inline.
- [x] **P3** — Migrate 38 templates: surfaces, hairlines, ink, accent, tint ladders, and ink-on-fill. Route: delegated writer.
- [x] **P4** — Correct the 40 solid semantic fills whose dark ink failed AA; darken each to step 700 and restore white ink. Route: inline (deterministic, 114 tokens).
- [x] **P5** — Replace the six remaining gradients with flat surfaces or the signal tile. Route: inline (6 elements, judgment).
- [x] **P6** — Migrate the three legacy class strings emitted from TypeScript. Route: inline (2 files).
- [x] **P7** — Verify build, contrast, and detector.

## Acceptance criteria

- Zero active `bg-white`, `text-slate-*`, `border-slate-*`, `divide-slate-*`, `bg-sky-*`, `text-sky-*` in templates.
- Zero gradients.
- Every text/fill pair in use measures ≥4.5:1.
- `ng build` succeeds; the type scan stays clean.

## Checks

- `cd frontend && npm run build`
- `impeccable detect --json --scope type src`
- `impeccable detect --json src`

## Progress

Complete.

**Evidence**
- Substitutions: 1 570 tokens across 38 templates by the delegated writer, verified independently.
- Contrast correction: 114 tokens over 19 files. Measured after the fix — white on `emerald-700` 5.48, `rose-700` 6.29, `purple-700` 6.98, `violet-700` 7.10, `indigo-700` 7.90, `cyan-700` 5.36; `on-signal` on `signal` 8.01.
- Ink on surface: `ink-body` 15.19, `ink-label` 11.59, `ink-muted` 6.71. On `well`: 6.94. On `surface-elevated`: 6.08. `signal` on `surface` 9.52.
- Final token counts in templates: `border-hairline` 232, `bg-surface` 174, `bg-signal` 99, `text-on-signal` 37, `text-ink-muted` 243.
- `npm run build` → complete, exit 0. `detect --scope type` → `[]`. Full scan → 2 pre-existing findings, none introduced here.
- Diff: 45 files, 1 413 insertions, 1 687 deletions.

**Deviations**
- Solid semantic buttons are **700 with white ink**, not 600 with dark ink. The mapped `text-{hue}-950` on `bg-{hue}-600` measured 2.54:1 (indigo) to 4.02:1 (emerald) — under AA for five of six hues. `DESIGN.md` was amended to record the rule.
- The detector's `ai-color-palette` warning on `disputas-admin-page` (violet modal title) is left in place: violet is the committed colour for disputes and the title measures 7.5:1.

## Not verified

The PrimeNG runtime skin. `darkModeSelector: '[data-cd-dark]'` is read at runtime and emits styles into `<head>`, so the built CSS cannot confirm it. It needs one look in a browser.

## Next step

Delete the 902 inert `dark:` tokens as an isolated, render-neutral cleanup, then `clarify`.
