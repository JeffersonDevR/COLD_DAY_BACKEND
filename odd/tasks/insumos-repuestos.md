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

- [x] **T1** (backend) — `c2312cf` `feat(backend): POST /api/ot/{id}/insumos for later parts requests`. `SolicitarInsumosOtUseCase` reusa `SolicitarInsumoUseCase.solicitar` (mismo broadcast, vigencia, `SIN_PROVEEDOR`); guard: técnico asignado (403), estados OT permitidos **ASIGNADA / EN_CAMINO / EN_DIAGNOSTICO / EN_REPARACION / DISPUTADA** (409 con `SolicitudInsumosInvalidaException` en terminales); líneas vacías → 400 (`@NotEmpty`). 201 con el DTO del requerimiento creado. Tests: `SolicitarInsumosOtUseCaseTest` (14) + `OtInsumosIT` (6).
- [x] **T2** (backend) — `ab10fe9` `feat(backend): GET /api/ot/{id}/insumos listing a technician's parts requests`. `ListarInsumosOtUseCase` + respuesta reusa `SolicitudInsumoApiResponse`, requerimientos newest first; 403 otro técnico, 404 OT inexistente, 200 lista vacía. `OtInsumosIT` ampliado.
- [ ] **T3** (frontend) sección "Repuestos" en `ejecucion-ot-page` + servicios API con mock. Spec con `HttpTestingController` real.
- [ ] **T4** (frontend) spec de `solicitudes-proveedor-page`.
- [ ] **T5** verificación final: suites backend (base: 130 suites / 887 tests / 0 tras T1+T2 — el baseline 127/856 del doc equipo ~2 tests rezagados; nueva base para comparar) + `npm test -- --watch=false` (frontend, **no `npx vitest`**), `tsc` app+spec, `eslint`. Baseline frontend: 74 archivos / 671 tests / 0.

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
- 2026-10-26: T1 DONE (`c2312cf`) + T2 DONE (`ab10fe9`). Writer: suite backend completa `gradlew.bat test` → BUILD SUCCESSFUL, **130 suites / 887 tests / 0 fallos**. Spot check del parent: re-corrida de las 3 suites nuevas → `BUILD SUCCESSFUL (2m 24s)`; archivos y commits verificados en el árbol.
- 2026-10-26: **Review nativa no transitable**: `review assess` con `--agent opencode` → `immutable_review_transport_unsupported` (runtimes de review inmutable soportados: claude-code, codex). RDD sigue **on** (global). Fallback por tier (assess fallido = tier alta): verificador independiente del slice backend en background, sin tocar el switch de review. Pendiente reportar al usuario al cierre.
