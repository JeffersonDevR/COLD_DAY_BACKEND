# Feature: ui-dark-ops-pass

## Objective
Bring the Ionic mobile app (`frontend/projects/mobile`) to visual and behavioural parity with the Stitch "Dark Ops" prototypes, screen by screen, without touching the operational core (another session owns backend/domain work).

## Problem
The theme layer is correct (dark cascade fixed in `3f83991`), but the page layer drifts: no bottom CTA primitive (`ion-footer` count = 0), truncation baked into shared OT card styles (`styles.css:634`, `:653-654`), 69 font-size declarations at or below 0.74rem (sub-12px), touch targets under 48dp, semantic colours re-tinted outside the tokens, and spec-forbidden content ("Próximamente", photo strip, roadmap promises).

## Ground truth
- `docs/design/dark-ops/flujo-solicitud/README.md` + the four prototypes in the same folder.
- `odd/tasks/ionic-stitch-fidelity.md` (pre-fix audit, per-screen deltas for A1–A5).

## Scope (sequence, one commit per screen)
| # | Screen | Route/path | Status |
|---|---|---|---|
| A1 | Login | `pages/login` | in progress |
| A2 | Registro | `pages/registro` | pending |
| A3 | Mi cuenta / modo | `pages/cuenta` | pending |
| A4 | Panel cliente | `pages/panel-cliente` | pending |
| A5 | Solicitar servicio | `pages/solicitar-servicio` | pending |
| A6 | Seguimiento OT | `pages/seguimiento-ot` | pending |
| A7 | Diagnóstico / presupuesto | `pages/diagnostico` | pending |
| A8 | Pago y acta | `pages/pago-acta` | pending |
| A9 | Calificar servicio | `pages/calificar` | pending |
| B1 | Radar de ofertas | `pages/ofertas-tecnico` | pending |
| B2 | Mis OTs | `pages/panel-tecnico` | pending |
| B3 | Ejecución de OT | `pages/ejecucion-ot` | pending |
| B4 | Perfil técnico | `pages/perfil-tecnico` | pending |
| C1 | Solicitudes de insumos | `pages/solicitudes-proveedor` | pending |
| C2 | Documentos del proveedor | `pages/documentos-proveedor` | pending |

## Acceptance criteria per screen
1. CTA primary in a fixed bottom bar (thumb zone) with `env(safe-area-inset-bottom)`, height >= 48px.
2. No truncation: text wraps; no `line-clamp`/`nowrap + ellipsis` on user content.
3. Type floor: functional labels/microcopy >= 12px, weight 500-600.
4. Touch targets >= 48x48dp for every interactive element.
5. Colours only from tokens (`--ion-color-primary` #22d3ee, `--cd-surface`, `--cd-muted`, semantic success/amber/rose); no ad-hoc hex.
6. One primary action per screen; secondary actions ghost/outline.
7. No "Próximamente", photo-evidence section, or roadmap copy.
8. Focus visible on every interactive element; icon-only buttons have `aria-label`; async actions expose `aria-busy`.
9. Existing specs stay green; new behaviour covered by a spec.

## Constraints
- Read-only on `backend/`, `frontend/src/` (web app) and domain/core services except where a screen's data contract is wrong.
- Copy tone: keep the app's current voice (voseo) until the user decides on the neutral-Spanish migration; do not mix tones inside a screen.
- Runner: `cd frontend && npm test -- --watch=false` (mobile project specs included); `npx tsc -p tsconfig.app.json --noEmit`.
- Branch `feat/ui-dark-ops-fidelity` in worktree `ui-dark-ops` (from `main`).

## Tasks
- [x] A1 Login — CTA 15px, focus-visible global, `aria-busy` + "Entrando…", error banner icon, logo radius token, footer type floor. Commit `7d270eb`.
- [x] A2 Registro — same auth patterns + icon-only password toggle with `aria-label`. Commit `7d270eb`.
- [x] A3 Mi cuenta — microcopy to the 12px floor (mode note/pill, role line). Commit `936ec57`.
- [x] A4 Panel cliente — hero out of `ion-toolbar`, fixed footer CTA, outline secondary, OT card no longer truncates, filters at 48dp/12px. Commit `42c46b2`.
- [x] A5 Solicitar servicio — vertical category cards with subtype + 24px check, "Describe la falla o ruido extraño" + real voice dictation, footer CTA "Solicitar técnico" with `aria-busy`, roadmap copy removed, profile CTA promoted. Commit `8e3364e`.
- [x] A6 Seguimiento OT — una primaria por estado, evidencias fuera, modales con focus trap + Escape. Commit `fcee354`.
- [x] A7 Diagnóstico — decisión en footer, chat "Próximamente" eliminado. Commit `61592d2`.
- [x] A8 Pago y acta — CTA en footer con `aria-busy`, hint de firma expuesto a AT. Commit `c4d1aef`.
- [x] A9 Calificar — CTA en footer, estrellas 48dp. Commit `92626c3`.
- [x] B1 Radar de ofertas — copy corregido (hablaba al cliente), accept con `aria-busy`. Commit `4037af0`.
- [x] B2 Mis OTs — acciones a 48dp. Commit `4037af0`.
- [x] B3 Ejecución de OT — acciones a la receta CTA. Commit `111a5a8`.
- [x] B4 Perfil técnico — CTA ya en receta; sin cambios de layout. Commit `111a5a8`.
- [x] C1 Solicitudes de insumos — accept/entrega con `aria-busy`. Commit `111a5a8`.
- [x] C2 Documentos del proveedor — guardado con `aria-busy`. Commit `111a5a8`.

## Progress
- 2026-11-05: worktree created from `main` (`d2acf20`), branch `feat/ui-dark-ops-fidelity`. Worktree audit re-run (the earlier audit read a dirty checkout): `ion-footer` 0, `ion-modal` 0, `cd-dim` declared but unused, 69 sub-12px declarations, 5 truncation rules.
- 2026-11-05: A1–A5 committed. New shared primitives: `.cd-footer` (fixed thumb-zone CTA with safe-area) and the global `:focus-visible` ring. Suite: login 9/9, registro 17/17, cuenta 5/5, panel 18/18, solicitar 21/21.
- Pending structural item: A5 is still a single screen. The brief's 3-step flow (Paso 1 ubicación → Paso 2 detalle → Paso 3 confirmación with "Solicitar técnico") needs its own work unit; today's CTA is labelled "Solicitar técnico" because the form emits directly.
- 2026-11-05 (cierre): A1–C2 completos. Suite mobile **244 tests / 20 archivos, 0 fallos**; `tsc -p projects/mobile/tsconfig.app.json --noEmit` en 0.
- Known environment noise: vitest/jsdom prints "Could not parse CSS stylesheet" for Ionic styles; pre-existing, does not fail tests.
