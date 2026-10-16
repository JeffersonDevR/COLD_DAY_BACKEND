# Feature: sse-asignacion-ot

## Objective
Que el flujo de OT deje de necesitar recargar la página: (1) la asignación de técnico debe llegar por SSE — hoy **nunca** llega —, y (2) si el stream muere, la página de seguimiento no debe quedar vieja para siempre.

## Problem
Síntoma reportado: *"sigue estando el problema de que se tiene que recargar la página en el flujo de OT"*.

**Causa raíz (verificada por el orquestador en el código, no inferida):** `AceptarOfertaUseCase.aceptar:106-107` asigna con un **UPDATE masivo** (`otRepository.intentarAsignar(...)`) y agrega el historial **a mano** (`:120-121`); **nunca llama `otRepository.save(ot)`**. `OtEstadoCambiado` se publica en **un solo lugar** — `OtRepositoryAdapter:86`, el drain del `save` — y el único puente SSE escucha ese evento (`OtEstadoCambiadoSseListener:39`). Por lo tanto `BUSCANDO_TECNICO → ASIGNADA`, la transición para la que existe el feature, **nunca llega al stream**. `seguimiento-ot-page` abre el stream una vez y **no tiene polling** → el cliente ve la página congelada hasta que recarga.

**Nota de diseño:** el doc original (`sse-tiempo-real-ot.md:130`) afirmaba que la asignación quedaba cubierta porque emite `OtAsignada`. Es falso: un evento sin listener no cubre nada. La suposición estaba mal desde el diseño, por eso nunca se notó.

**Secundario:** tras 5 fallos de reconexión el stream muere y **todos** los consumidores lo silencian (`error: () => {}`). Sin señal al usuario y **sin fallback** → staleness permanente.

## Scope
- **T1 (backend):** que la asignación emita el evento SSE. Opción elegida: un `@TransactionalEventListener(AFTER_COMMIT)` de `OtAsignada` que publique al `SseEmitterRegistry` con el mismo payload (`OtEstadoCambiadoSseApiResponse`), **sin tocar el UPDATE masivo** (decisión de concurrencia deliberada — AD2). + test.
- **T2 (frontend):** fallback en `seguimiento-ot-page`: si el stream muere (reintentos agotados), un **poll lento (25 s, como las otras páginas)** que se detiene al volver el stream o al destruirse el componente. + spec.
- **T3 (parent):** verificación final.

## Out of scope
- **SSE en `ofertas-page`** (el caso agudo del técnico: la ventana de 60 s) — requiere emitir al stream del técnico; otro slice.
- **Riesgos de despliegue** (no se resuelven por código): registry **en memoria** → split-brain si Render corre >1 instancia; falta de headers explícitos de anti-buffering (`X-Accel-Buffering`/`Cache-Control`). A probar en la app real.
- Los LOADS silenciosos y los 3 sitios con mensaje crudo (feature anterior).

## Constraints
- Backend: comentarios/JavaDoc/strings en **inglés**. Frontend: copy y comentarios en **español**.
- TDD standard (`strict_tdd: false`). Runners: backend `cd backend && gradlew.bat test` (Testcontainers/Docker); frontend `npm test -- --watch=false` (**baseline 70 archivos / 601 tests**), `npx tsc -p tsconfig.app.json --noEmit` y `-p tsconfig.spec.json`, `npx eslint <tocados>` (8 errores preexistentes repo-wide).
- Un writer por tarea, secuencial. Rama `fix/sse-asignacion-ot` desde `origin/main` (`48e8e9d`). Un solo PR. Push/merge son decisiones del usuario.

## Authorized scope
Usuario eligió **"Asignación + fallback"** (2026-10-16).

## Acceptance criteria
- [x] T1: al aceptar una oferta, el registry publica al stream de esa OT (con test que lo pruebe); el UPDATE masivo queda intacto. Evidence: commit `2df2628` (4 archivos, +205, **solo adiciones**); `OtAsignadaSseListener` (`@TransactionalEventListener(AFTER_COMMIT, fallbackExecution=true)` sobre `OtAsignada` → `registry.publicar(clave(otId), EVENTO, payload)`); reusa `EVENTO`/`clave(...)` que ya eran públicos (una sola derivación de la clave); payload = el mismo record que consume el front, con overload `de(OtId, EstadoOt, EstadoOt)` y la transición **real** BUSCANDO_TECNICO→ASIGNADA; tests: IT end-to-end que maneja `AceptarOfertaUseCase` sobre Testcontainers con stream SSE real + unit del listener. Suite backend **120 suites / 828 tests / 0 failures**.
- [ ] T2: si el stream de seguimiento muere, la página refresca por poll lento y deja de pollear cuando el stream vuelve / al destruirse (con test).
- [ ] T3: suites verdes (backend + frontend) + verificación independiente.

## Tasks
- [x] T1 (backend, delegated): listener de `OtAsignada` → registry. Route: delegated-direct. Evidence: commit `2df2628`; el writer hizo un **experimento discriminante** (sacó `@Component` del listener → falló **solo** el test del caso, los otros 7 pasaron) → el test detecta el bug de verdad; verificó además que **no hay doble publicación** (`intentarAsignar` solo se llama desde `AceptarOfertaUseCase`, que no hace `save` de esa OT, y `OtAsignada` no tiene otro publisher).
- [ ] T2 (frontend, delegated): poll de respaldo en seguimiento. Route: delegated-direct.
- [ ] T3 (parent): verificación final + reporte.

## Delivery
- Forecast ~100–150 líneas → **un solo PR, sin cadena**.

## Progress
- 2026-10-16: doc creado en `fix/sse-asignacion-ot` (desde `origin/main` `48e8e9d`). Diagnóstico verificado por el orquestador: `AceptarOfertaUseCase:106-124` sin `save`; `OtRepositoryAdapter:86` única publicación de `OtEstadoCambiado`; `OtEstadoCambiadoSseListener:39` único puente al registry. Wiring del front sin mismatches (nombre de evento, `otId`, ticket) — no es la causa.
- 2026-10-16: T1 DONE (commit `2df2628`): el puente que faltaba. Verificación del writer: `cleanTest test --rerun-tasks` → BUILD SUCCESSFUL (5m20s), **120 suites / 828 tests / 0 failures**. Spot check del parent: re-corrida de los tests target → 2 suites / 10 tests / 0 failures; `OtEstadoCambiadoSseListener`, `OtRepositoryAdapter` y `AceptarOfertaUseCase` **intactos** (fuera del diff). Notas: Docker Desktop no estaba corriendo (el writer lo levantó) y `fallbackExecution=true` espeja el listener existente.
