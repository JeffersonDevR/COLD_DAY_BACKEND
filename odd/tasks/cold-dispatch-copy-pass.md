# Cold Dispatch — copy pass (`clarify`)

Objective: stop internal enum values and snake_case identifiers from reaching the screen, and close the few real copy defects. This is **not** a prose rewrite.

## What the audit found

| Expected | Actual |
|---|---|
| Colombian tuteo inconsistent across 40 templates | **Already consistent.** 44 `tu/tus`, 5 `tenés`, 4 `podés`, exactly **one** `ingrese` |
| Generic "algo salió mal" errors everywhere | **2** instances, both already specific ("No pudimos cargar tus equipos…") |
| Raw enum values leaking into filters | **12** interpolations, but they leak into *tables and headers* too |
| `replace('_',' ')` bug | **12** sites, every one of them on `categoriaServicio`, `doc.tipo` or `cat` |

So the real defect is structural: the product has enum types with no presentation layer, and one ad-hoc string hack standing in for it.

## Evidence

```
consignaciones-admin-page.html:141   {{ liq.estado }}
diagnostico-ot-page.html:152         Estado actual: {{ orden.estado }}
disputas-admin-page.html:37          {{ disp.estado }}
documentos-proveedor-page.html:82    {{ doc.tipo }}
liquidaciones-tecnico-page.html:158  {{ liq.medioPago }}
liquidaciones-tecnico-page.html:173  {{ liq.estado }}
panel-tecnico-page.html:135,288,293  {{ tecnico()?.estadoValidacion }}
validacion-tecnicos-page.html:50     {{ tec.estadoValidacion }}
app-topbar.html:52                   {{ usuario()?.rol }}
ot-timeline.html:77                  {{ item.estado }}
```

`String.prototype.replace` with a string replaces only the **first** match, so any identifier with two underscores renders half-converted.

`shared/estado-badge` already owns a correct label map for `EstadoOt`, `EstadoOperativo`, `EstadoValidacion`, `EstadoLiquidacion`, `EstadoDisputa` — but it is private to the badge, so every other surface reinvents it or skips it.

## Scope

Authorized: `frontend/src/app`.

- New: `core/ui/labels.ts` + `core/ui/labels.spec.ts`.
- `shared/estado-badge/estado-badge.ts` — consume the shared map instead of its private switch.
- The 12 interpolation sites and 12 `.replace` sites.
- Two accent typos and one `ingrese`.

Out of scope: rewriting prose that is already clear, changing factual claims, the fabricated `4.9` metric (belongs to `harden`), and anything in `landing/` or `projects/mobile`.

## Terminology (normative)

Sentence case for every label. No ALL CAPS from the data layer — uppercase is a CSS decision (`uppercase` class), never a string transform.

| Enum | Label |
|---|---|
| `BUSCANDO_TECNICO` | Buscando técnico |
| `SIN_TECNICOS_DISPONIBLES` | Sin técnicos disponibles |
| `PENDIENTE_CONSIGNACION` | Pendiente de consignación |
| `EN_VERIFICACION` | En verificación |
| `RESUELTA_CON_ACUERDO` | Resuelta con acuerdo |
| `RESUELTA_SIN_ACUERDO` | Resuelta sin acuerdo |
| `BLOQUEADO_POR_LIQUIDACION` | Bloqueado por liquidación |
| `FUERA_DE_SERVICIO` | Fuera de servicio |
| `EN_REVISION` | En revisión |
| `AIRE_ACONDICIONADO` | Aire acondicionado |
| `CAMARAS_VIGILANCIA` | Cámaras de vigilancia |
| `ANTECEDENTES_POLICIA` | Antecedentes de policía |
| `CERTIFICACION_CONTE` | Certificación CONTE |
| `CERTIFICACION_SENA` | Certificación SENA |
| `MATRICULA_CONTE` | Matrícula CONTE |
| `EFECTIVO` / `TRANSFERENCIA` | Efectivo / Transferencia |
| `CLIENTE` / `TECNICO` / `ADMINISTRADOR` / `CONTABLE` / `PROVEEDOR` | Cliente / Técnico / Administrador / Contable / Proveedor |

Acronyms that stay uppercase: `SENA`, `CONTE`, `RUT`, `B2B`, `B2C`.

## Tasks

- [ ] **C1** — Write `core/ui/labels.ts`: one exported function per enum family, each `(value) => string`, exhaustive over the union so a new enum member fails the build. Plus `categoriaLabel`, `documentoLabel`, `medioPagoLabel`, `rolLabel`.
- [ ] **C2** — Write `labels.spec.ts` covering every member of every union.
- [ ] **C3** — Refactor `estado-badge` to use the shared map; keep its severity and icon switches.
- [ ] **C4** — Replace the 12 raw interpolations with the label functions. Do **not** introduce `<app-estado-badge>` into new surfaces: this pass changes wording, not components.
- [ ] **C5** — Replace the 12 `.replace('_', ' ')` calls with `categoriaLabel()` / `documentoLabel()`.
- [ ] **C6** — Fix `ingrese` → `ingresa`, and the two accent typos (`intentalo` → `inténtalo`, `Revisá` → `Revisa`).

## Acceptance criteria

- Zero `{{\s*[\w().?]*\.(estado|tipo|rol|medioPago|estadoValidacion|estadoOperativo|estadoLiquidacion)\s*}}` in templates.
- Zero `.replace('_', ' ')`.
- `labels.spec.ts` covers every union member.
- `ng build` and `ng test` pass.

## Checks

- `cd frontend && npm run build`
- `cd frontend && npm test -- --run`

## Progress

Complete.

**Delivered**
- `core/ui/labels.ts` — 10 label functions over every enum the UI renders, plus `estadoBadgeLabel` as the shared dispatcher. Sentence case, no uppercase transform, no DI.
- `core/ui/labels.spec.ts` — 48 enum members asserted, plus the dispatch and the unknown-value fallback.
- `shared/estado-badge/estado-badge.ts` — its private label switch is gone; it now reads from the shared layer. `severity` and `iconClass` untouched.
- 12 raw interpolations replaced, 11 `.replace('_',' ')` sites replaced, plus 5 more raw-enum leaks of the same class found and fixed (`panel-tecnico` ×3, `mi-perfil-tecnico`, `documentos-proveedor`, `proveedores-admin`).
- Copy: `intentalo` → `inténtalo` in `historial-equipos-page`.

**Corrections made during review**
- `sinEtiqueta` originally **threw** at runtime. Compile-time exhaustiveness is right; a runtime throw is not — an unknown backend state would blank an operator's table. It now returns the raw identifier, with the `never` guard still failing the build on a new enum member. Two tests restored to lock that behaviour.
- The single `ingrese` was **not** an usted imperative. `"te notificará apenas ingrese un requerimiento"` is correct subjunctive, and the change to `ingresa` was reverted. The audit's premise that tuteo needed a pass was wrong: it was already consistent.

**Verification**
- `npm run build` → complete, exit 0.
- `npx ng test --watch=false --project app` → **84 files, 893 tests passed**.
- `\.replace\('_', ' '\)` → 0. Raw enum bindings → 0.

**Open**
- `documentos-proveedor-page` casts `doc.tipo: string` to `TipoDocumentoProveedor`. The contract types that field loosely while the form only emits four values; tightening it belongs to the API contract, not this pass.
- The fabricated `4.9★ Reputación media` on the login page is untouched — factual claim, belongs to `harden`.
