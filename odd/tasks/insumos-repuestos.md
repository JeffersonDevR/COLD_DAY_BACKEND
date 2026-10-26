# Feature: insumos-repuestos — repuestos por OT del técnico (roadmap 2.4)

## Objetivo

Que el técnico pueda **proponer/agregar repuestos a una OT a posteriori** (no solo pegados al diagnóstico), y que la UI del proveedor quede con tests. Roadmap: `docs/pendientes.md` §2.4.

## Problema y mapeo (verificado 2026-10-26)

- **No existe entidad `Insumo` ni catálogo**: `RequerimientoInsumo.java:22` lo documenta como decisión del dominio. Las líneas son texto libre (`InsumoLinea`: `descripcion` + `cantidad`). **Decisión: no inventar catálogo**, seguir el modelo broadcast.
- La **UI del proveedor ya existe** (`solicitudes-proveedor-page`, ruta `proveedor/panel`): `getMisSolicitudes` + aceptar/rechazar/entregar. Hoy sin spec.
- `RequerimientoInsumo` solo se crea como efecto colateral de `POST /api/ot/{id}/diagnostico` (`RegistrarDiagnosticoUseCase:70-72` → `SolicitarInsumoUseCase.solicitar`). **No hay endpoint para agregar insumos a posteriori ni para consultar el requerimiento de una OT.**
- Flujo insumos vigente: broadcast `OfertaInsumo` por proveedor activo → `PENDIENTE` → primer-acepta gana (`ACEPTADA`, resto `RECHAZADO` 409) → `ENTREGADO`. `SIN_PROVEEDOR` es retriable. Vigencia `app.insumos.vigencia-ms` (default 900000).
- Nota: el roadmap §2.4 dice "el dominio ya tiene `Insumo`" — **premisa incorrecta**; corregir en `pendientes.md` al cerrar.

## Alcance autorizado

1. Backend: `POST /api/ot/{id}/insumos` (TÉCNICO asignado de esa OT; OT en estado no terminal y pasada la etapa de diagnóstico) → crea un nuevo `RequerimientoInsumo` **reusando `SolicitarInsumoUseCase.solicitar`** (mismo broadcast, misma vigencia, mismo `SIN_PROVEEDOR`).
2. Backend: `GET /api/ot/{id}/insumos` (TÉCNICO asignado) → estado + items del(los) requerimiento(s) de la OT para pintar la UI.
3. Frontend técnico: sección **"Repuestos"** en `ejecucion-ot-page`: estado del requerimiento + form de líneas (descripcion + cantidad) → `POST`, y reintento visible tras `SIN_PROVEEDOR`.
4. Frontend `tecnicos-api.ts`/`ot-api.ts` (lo que corresponda): `solicitarInsumos` + `getInsumosOt` con branch real y branch mock (MockDbService).
5. Frontend proveedor: spec para `solicitudes-proveedor-page` (~6-8 tests, patrón `solicitar-servicio-page.spec.ts`).

## Fuera de alcance

- Catálogo de `Insumo` / CRUD de catálogo del proveedor (contradice la decisión documentada del dominio; sería otro feature).
- Exponer `oferta.requerimientoId` (ya se dejó de exponer por ser id interno).
- SSE nuevo para insumos; el listado del proveedor ya muestra el broadcast.

## Checklist

- [ ] **T1** (backend) endpoint `POST /api/ot/{id}/insumos` + guard (técnico asignado, estado OT válido) reusando `SolicitarInsumoUseCase`. Tests: use case + IT (y la rama `SIN_PROVEEDOR`).
- [ ] **T2** (backend) endpoint `GET /api/ot/{id}/insumos`. Tests: IT 200 del titular / 403 otro técnico / vacío si no hay requerimientos.
- [ ] **T3** (frontend) sección "Repuestos" en `ejecucion-ot-page` + servicios API con mock. Spec con `HttpTestingController` real.
- [ ] **T4** (frontend) spec de `solicitudes-proveedor-page`.
- [ ] **T5** verificación final: suites backend + `npm test -- --watch=false` (frontend, **con `--watch=false`; `npx vitest` sobra**), `tsc` app+spec, `eslint`. Comparar contra baseline: backend 127 suites / 856 tests; frontend 74 archivos / 671 tests.

## Criterios de aceptación

- El técnico agrega repuestos desde su OT después del diagnóstico, y reintenta tras `SIN_PROVEEDOR`.
- El proveedor ve la nueva solicitud por el broadcast existente; su página queda testeada.
- Suite verde: backend + frontend sin regresión contra baseline.

## Verificación y decisiones

- Ruta: `feat/insumos-repuestos` (desde `origin/main` 3d7eef5), en el worktree `C:\Users\SENA\AppData\Local\Temp\opencode\t2-verify-6b9f3d8`.
- TDD del proyecto: modo estándar (suite verde por task; no strict-TDD activo).
- Entrega: strategy `ask-on-risk`; forecast inicial ~350-450 líneas. Si el conteo corrido pasa ~400, preguntar antes de seguir.
- Persistencia del doc: mirror en Engram topic `odd/insumos-repuestos/tasks`.

## Progreso

- 2026-10-26: feature doc creado; mapping verificado; arranca T1.
