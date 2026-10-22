# Feature: filtro-ots-cliente

## Objective
Que el cliente pueda filtrar sus órdenes de trabajo en el panel por **estado de avance** — todas, activas, completadas y sin técnico — sin pedirle nada nuevo al backend.

## Problem (mapeo verificado 2026-10-22)
`panel-cliente-page.ts:27-33` calcula dos listas y **nunca muestra las completadas**:

```ts
readonly serviciosActivos = computed(() =>
  this.serviciosCliente().filter(o => !['FINALIZADA', 'CANCELADA'].includes(o.estado)));
readonly serviciosFinalizados = computed(() =>
  this.serviciosCliente().filter(o => o.estado === 'FINALIZADA'));
```

- `serviciosFinalizados` solo alimenta el **contador** de la métrica (`panel-cliente-page.html:56`) — no hay lista de completadas en ninguna parte de la página.
- Las OTs `CANCELADA` no caen en ninguna de las dos listas: desaparecen del panel.
- No hay forma de ver **solo las que todavía esperan técnico** (`estado === 'SOLICITADA' | 'BUSCANDO_TECNICO'`, o `tecnicoId` nulo), que es justo lo que el cliente quiere mirar cuando está esperando.
- El endpoint ya devuelve todas las OTs del cliente (`getOtsPorCliente`) y la página ya las tiene en memoria: **el filtro es 100% front**.

## Scope
- **T1 (frontend, S):** señal de filtro + lista derivada + control en el template + estados vacíos por filtro + spec.
  - `panel-cliente-page.ts`: `filtro = signal<FiltroOts>('ACTIVAS')` y `serviciosFiltrados = computed(...)`.
  - `panel-cliente-page.html`: control segmentado (Todas / Activas / Completadas / Sin técnico) + render de `serviciosFiltrados()`.
  - `panel-cliente-page.spec.ts`: cada filtro devuelve lo que corresponde (incluye `CANCELADA` fuera de activas y una OT sin `tecnicoId`).

## Definición de cada filtro (contrato de la feature)
| Filtro | Qué muestra |
|---|---|
| `TODAS` | todas las OTs del cliente |
| `ACTIVAS` | `estado` distinto de `FINALIZADA` y `CANCELADA` (comportamiento actual de la lista) |
| `COMPLETADAS` | `estado === 'FINALIZADA'` |
| `SIN_TECNICO` | `!ot.tecnicoId && estado !== 'CANCELADA'` (las que esperan asignación) |

- El default es `ACTIVAS`: es la vista que el cliente ya conoce; el filtro **agrega** las otras sin cambiar la de entrada.
- Los contadores de las métricas (activas / concluidas) **no** dependen del filtro: son el resumen de toda la cuenta.

## Out of scope
- Filtro por fecha, categoría o texto libre.
- Query param en el backend (`GET /api/clientes/{id}/ot?estado=`). El cliente ya trae todo y el volumen por cliente es chico; si algún día crece, se mueve al backend.
- Lista de canceladas como filtro propio (caen en `TODAS`; si aparece la necesidad, se agrega).

## Constraints
- Frontend: copy y comentarios en **español**.
- TDD standard. Runner: `cd frontend && npm test -- --watch=false` (baseline 73 archivos / 653 tests), `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx eslint <tocados>` (8 errores preexistentes repo-wide, no tocar).
- Sin backend, sin endpoints nuevos, sin dependencias nuevas.
- Un writer, una rama `feat/filtro-ots-cliente` desde `main`.
- Push / PR / merge: decisión del usuario.

## Authorized scope
Usuario (2026-10-22): *"dale arranca con esos 2"* — los dos baratos del roadmap (`docs/pendientes.md` §2.3 y §2.2).

## Acceptance criteria
- [x] T1: el panel del cliente tiene un control de filtro con las 4 opciones y la lista responde a él; cada opción muestra exactamente lo de la tabla de arriba; los estados vacíos dicen qué falta; suite + tsc + eslint verdes.
  Evidence: commit `5f084da` (3 archivos, +194/−12). `FiltroOts` + `filtro` signal (default `ACTIVAS`) + `serviciosFiltrados` computed con el contrato exacto de la tabla; `serviciosActivos`/`serviciosFinalizados` intactos (los contadores no siguen el filtro, hay spec que lo asegura). Control segmentado `role="group"` + `aria-pressed` + `type="button"`. Título neutro "Mis Servicios Técnicos" y subtítulo/vacío por filtro (el texto de `ACTIVAS` no cambió, el spec viejo sigue pasando). **Frontend 73 archivos / 662 tests / 0 fallos** (+9), `tsc` app+spec 0, `eslint` 0 en los tocados. Parent spot check: suite re-corrida, 662/0 confirmado.

## Tasks
- [x] T1 (frontend, delegated): filtro + control + estados vacíos + spec. Route: delegated-direct (2+ archivos no triviales).

## Progress
- 2026-10-22: doc creado tras el mapeo (con `path:line` del problema).
- 2026-10-22: T1 DONE (`5f084da`). Verificación del writer + spot check del parent: 73/662/0, `tsc` app+spec 0, `eslint` 0. Mergeado en main vía PR #59 (`cd9b885`); integración en main verificada: 74 archivos / 671 tests / 0 fallos. Cerrada.

## Delivery
- Forecast: ~120–180 líneas (señal + computed + template + spec). Un PR, sin cadena.
