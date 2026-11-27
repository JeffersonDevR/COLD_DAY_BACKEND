# Feature: landing-admin-stitch-screens

## Objective
Generate DESKTOP Stitch screens for the public landing and the web admin panel, in separate groups, following the active "Cold Day Mobile Experience" design system (assets/56187be0b7da46d0ba6d14f402df418a), inside Stitch project 6368230144082370659 ("Markdown Task Runner").

## Why
User request (2026-10-26): design-first delivery. Scope agreed: Stitch screens only, no repo code changes. The admin mirrors the real Angular modules (dashboard, proveedores validation, disputas, consignaciones) discovered in frontend/src/app/pages/*-admin-page.

## Scope
- L1 (group LANDING): full desktop landing — hero, services grid (refrigeración, lavadoras, cocinas), how-it-works 3 steps, CTA "Solicitar técnico", login/registro CTAs, footer. Spanish voseo copy per design system.
- D1 (group ADMIN): admin shell (sidebar: Dashboard, OTs, Técnicos, Proveedores, Disputas, Consignaciones) + dashboard metrics + recent OTs table with status chips.
- D2 (group ADMIN): proveedores documental validation list — estadoValidacion badges PENDIENTE/APROBADO/RECHAZADO, approve/reject actions, motivo modal on reject.
- D3 (group ADMIN): disputas management — dispute list with status, resolution panel.

## Constraints
- All generations: designSystem assets/56187be0b7da46d0ba6d14f402df418a, deviceType DESKTOP, project 6368230144082370659.
- Generation takes minutes; on timeout DO NOT retry blindly — poll get_screen instead.
- UI copy: Spanish voseo suave. Prompts: English.
- No repo source writes besides this tracking doc.

## Design pass (2026-10-27)
User feedback: visual overload per screen, overflowing texts. Applying a design pass to all 4 screens: stricter whitespace/8pt rhythm, max content width, 3-level typography hierarchy, text clamping/ellipsis (no overflow), max 3 visual blocks per section, progressive disclosure for dense tables/timelines, one primary action per viewport, color only on status chips.

## Design system exploration (2026-10-27)
Separate project to compare directions without polluting the main one: **COLD DAY · Exploración UI (design systems)** = `projects/8043960673159851981`. Same landing content across all four variants (fair comparison), one representative screen each:

| Direction | Design system asset | Screen |
|---|---|---|
| Editorial Trust | assets/2128284937734388494 | projects/8043960673159851981/screens/0bf4ae1dae8842d5ae98c6f826b0cb2e |
| Bento Product | assets/1489180818591219626 | projects/8043960673159851981/screens/91d43d24271b43a39b995d2929588304 |
| Dark Ops | assets/15434124440240692659 | projects/8043960673159851981/screens/28c467e79b134bc18e12ad479b007f5d |
| Neo-Brutalist | assets/9840831581872775925 | projects/8043960673159851981/screens/df6e63cf66b94835aa2947cde3365fc5 |

Known gotcha: `create_design_system` rejects `spacingScale` (read-only field); use `spacing` map only. Leftover `Test Minimal DS` (assets/16812195531160216761) from schema probing — no delete API in the MCP.

### A5 "Solicitar servicio" cross-direction comparison (2026-10-27)
Same mobile screen (step 2 of 3) in all five directions:

| Direction | Screen |
|---|---|
| Cold Day current (Ionic) | projects/6368230144082370659/screens/5e1ee2ff362d48378e5c6948f0a1703c |
| Editorial Trust | projects/8043960673159851981/screens/0631e7b1aca94d05aacd6b900384233f |
| Bento Product | projects/8043960673159851981/screens/a52103c123b34d72980deff6995bc018 |
| Dark Ops | projects/8043960673159851981/screens/d13f642a4a2441669a6f51b32f5a7378 |
| Neo-Brutalist | projects/8043960673159851981/screens/c6c5fded27174f9b9f71993d8acd1ca9 |

All status COMPLETE. Decision pending: which direction to roll out across landing + 4 admin modules + mobile flow.

### Final comparison project — 5 A5 styles in one place (2026-10-27)
`projects/13606830941433490180` = **COLD DAY · Comparación · Solicitar Servicio (5 estilos)**. Generated sequentially (parallel generations do not reliably materialize in the canvas). Five design systems created in-project, one A5 step-2 mobile screen each:

| # | Style | Screen |
|---|---|---|
| 1 | Actual (Ionic) | projects/13606830941433490180/screens/be5d2257667e43bfa1e88c9001b3149e |
| 2 | Editorial Trust | projects/13606830941433490180/screens/5931f6ffa978450c81d418fb0eedca7d |
| 3 | Bento Product | projects/13606830941433490180/screens/fa5800948b674f23af026c203f7634b1 |
| 4 | Dark Ops | projects/13606830941433490180/screens/46abac423d3947c18e0e4561345ef7fa |
| 5 | Neo-Brutalist | projects/13606830941433490180/screens/906f8755ce004bd59b431e0359b909bc |

Canvas gotcha: `get_project` reports 5 instances but two (Dark Ops, Neo-Brutalist) come back with a null label and are absent from `list_screens` titles — they exist and render, just unlabeled. There is no move/rename screen tool in the MCP.

## Dark Ops roll-out for Ionic (2026-10-30)
Decision: Dark Ops is the chosen direction. Generated the full 15-screen mobile set in the main project `6368230144082370659` with design system `assets/46903166542844201` ("Cold Day · Dark Ops (Ionic)"), sequential batches of 3. Verified dark tokens in generated HTML (#0b1220/#111b2e/#22d3ee, zero light tokens), unlike `apply_design_system` on the old screens which returned COMPLETE but kept the light palette embedded.

| Screen | Resource |
|---|---|
| A1 Login | screens/b7e7e5fb76624f89b1087807ac3ece7c |
| A2 Registro | screens/df46f7ca39c849dcac86910ab82b9379 |
| A3 Mi cuenta / rol | screens/6abecfe0ebbd4ee78232ab3d5a07e941 |
| A4 Panel cliente | screens/58884969151e4ca28ad6d8965499b1fa |
| A5 Solicitar (paso 1) | screens/26a9b6e04e4c4277bdedd73632cc8bea |
| A6 Seguimiento OT | screens/a16462993eee48d1a35b7d6673338c0a |
| A7 Diagnóstico/presupuesto | screens/6d409d30e5a04b59a19af5490763c195 |
| A8 Pago y acta | screens/7e172cabc8ae49f7bf7e0e3c6ce62c73 |
| A9 Calificar | screens/6ff61e63817440af9cfa1e125b2d3459 |
| B1 Radar de ofertas | screens/96f58122a21744da8c1b5f23c6bf2edd |
| B2 Mis OTs | screens/4db819dc3bd74f17a2d507c5ac4f27bd |
| B3 Ejecución de OT | screens/dddcb295066946ad8b590c33d7b990f1 |
| B4 Perfil técnico | screens/8ce57685437b4ef78f40f30789df7216 |
| C1 Solicitudes de insumos | screens/b2653479b8db43cb82eeed5db942987e |
| C2 Documentos del proveedor | screens/e8b8a35e8e924e8581ae17b928d96f1b |

Notes: a parallel-generated copy also exists in `projects/1546876662301161963` (COLD DAY · Dark Ops · App Mobile (Ionic)) but that project's canvas reports 0 instances — resources exist, not visible; treat the main-project set as canonical.

## UI/UX pass on the transactional flow (2026-10-30)
Brief applied: vertical category cards with full names + subtype and 24x24 selection indicator top-right, "Dictar por voz" with mic (no static "Voseo asistido"), single clickable "Ubicación guardada" card (56dp) + read-only coordinates, photo/video section removed entirely, secondary text #94a3b8 / labels #cbd5e1 with >=12px semibold, CTA "Continuar a revisión" (steps 1-2) reserving "Solicitar técnico" for step 3, explicit disabled/loading states, 48dp minimum touch targets, swipe-back affordance.

New design system: `assets/16250156269589296743` "Cold Day · Dark Ops (Ionic) AA" (labels 13px, caption 12px).

| Screen | Resource |
|---|---|
| A5.1 Ubicación (paso 1) | screens/3f96bf6b6fec4dd18ddceec3b2c6fcad |
| A5.2 Detalle (paso 2) | screens/3ff5666d64d149b78aca9842878de828 |
| A5.3 Confirmación (paso 3) | screens/b1458302df144a31bba98ccbbc3ee950 |
| Especificación · Estados del CTA | screens/971ab45c2edc486795dbed3de794d4eb |

Content verification (HTML fetch, not just status): all four contain the required copy ("Ubicación guardada", "Dictar por voz", "Continuar a revisión", "Solicitar técnico", "Procesando", "Solo lectura"), use #94a3b8/#cbd5e1, and contain none of "Próximamente", photo-section copy, "Voseo" or #64748b.

Canvas caveat: project instance count froze at 37; none of the four new screens (nor the regenerated B3/B4/C1/C2) attached to the canvas at generation time. Resources and HTML are valid and fetchable.

**Fallback delivered (option 2):** exported the four flow prototypes to `docs/design/dark-ops/flujo-solicitud/` — `a5-1-ubicacion.html`, `a5-2-detalle.html`, `a5-3-confirmacion.html`, `estados-cta.html`, plus `README.md` with tokens, rule checklist, Ionic component mapping and known limitations. HTML tag balance verified (div/button open-close pairs match in all four files).





## Tasks
- [x] L1 landing desktop (group LANDING) — `projects/6368230144082370659/screens/f1297d46f7ae4cbebbe242413f75852b`, status COMPLETE, html `.../files/1a0a482c4aee4235a4f95bc993c3e443`
- [x] D1 admin dashboard + shell (group ADMIN) — `projects/6368230144082370659/screens/3ae4168e7c4e4992a9ce43e55265bc80`, status COMPLETE
- [x] D2 proveedores validación (group ADMIN) — `projects/6368230144082370659/screens/134f4f1c3f0d4827bbc8efe020f0dd0f`, status COMPLETE
- [x] D3 disputas (group ADMIN) — `projects/6368230144082370659/screens/509538c3fb6c4f20b74560fa17e3ef96`, status COMPLETE
- [x] D4 consignaciones / conciliación contable (group ADMIN) — `projects/6368230144082370659/screens/6a7b38a170594d98ace2f519f320b1a0`, status COMPLETE (Bancolombia/Nequi commission audit + technician unblock, mirrors consignaciones-admin-page)

## Progress
- 2026-10-26: doc created after design-system review (active DS = Cold Day Mobile Experience; old "Cold Day Service System" from Aug is obsolete). Route: orchestrator-driven MCP generation, no repo writers.
- 2026-10-27: design pass applied to all 4 screens (edit_screens): 12-col grid max 1240px, 24px gutters, 8pt rhythm, 3-level typography floor 12px, text clamping/ellipsis (no overflow), max 3 visual blocks per view, progressive disclosure (collapsed activity/timeline), one primary action per viewport, color restricted to status chips + primary CTA. New HTML assets regenerated per screen.

## Delivery
- N/A (remote Stitch artifacts). Evidence: screen resource names recorded per task.
