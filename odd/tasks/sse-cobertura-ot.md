# Feature: sse-cobertura-ot

## Objective
Cerrar los huecos de actualización en vivo del flujo de OT: (1) que el **técnico** vea las ofertas nuevas sin estar en la pantalla y sin refrescar, y (2) que **ninguna** página con SSE quede vieja para siempre si el stream muere.

## Problem
Revisión 2026-10-16 (post-merge de `sse-asignacion-ot` y de la remoción del SSR):

**El técnico (el hueco grande).**
- `ofertas-page.ts:48-50` solo tiene un poll de 25 s **y corre solo con la pestaña visible en esa página** → una oferta nueva (ventana de 60 s) se pierde si el técnico está en otra pantalla.
- El backend **no emite nada** al crear una oferta: `IniciarBusquedaTecnicoUseCase:78-83` crea las ofertas sin publicar evento (no existe `OfertaCreada`).
- **Estructural:** el registry de SSE está **keyed por OT id** (`OtEstadoCambiadoSseListener.clave(otId)`), y `ofertas-page` no tiene contexto de OT → "una oferta nueva para ESTE técnico" **no se puede expresar** con esa clave. Hace falta un namespace nuevo (`tecnico:{id}`).

**Resiliencia (hueco chico).**
- `ejecucion-ot-page.ts:223-234`, `diagnostico-ot-page.ts:94-104` y `pago-acta-page.ts:103-113` consumen SSE **sin poll de respaldo** → si el stream agota los 5 reintentos, quedan viejas **para siempre** (solo `seguimiento-ot-page` tiene el fallback, agregado en `sse-asignacion-ot`).

**Lo que ya está bien** (no tocar): las transiciones de OT llegan por SSE (incluida la asignación); `seguimiento` tiene SSE + fallback; panel cliente, monitoreo y panel técnico pollean cada 25 s; los flujos admin refetchean tras la propia acción.

## Scope
- **T1 (backend):** canal SSE **por técnico** — namespace `tecnico:{id}`, evento al crear la oferta, endpoint `GET /api/tecnicos/me/ofertas/stream` reusando el ticket existente (`SseTicketService` es identity-only, resource-agnostic).
- **T2 (frontend):** `SseService.abrirOfertasTecnico()` + suscripción en `ofertas-page` (refetch al evento), **conservando el poll como respaldo**.
- **T3 (frontend):** poll de respaldo en las 3 páginas SSE que no lo tienen (mismo patrón que `seguimiento-ot-page`).
- **T4 (parent):** verificación final.

## Out of scope (documentado, feature aparte)
- **Tablero admin:** disputas, consignaciones, liquidaciones y validación de técnicos **no se actualizan** (no hay bridges para `DisputaAbierta/Resuelta`, `LiquidacionRegistrada/Aprobada/Rechazada`, `ComprobanteCargado`, `TecnicoValidado`). Requiere un canal `admin` (fan-out + ticket de admin) — M/L.
- **Escalada de radio visible:** `OtSinTecnicosDisponibles` (`EscalarRadioUseCase:104`) no se emite: el estado queda `BUSCANDO_TECNICO` y no hay `CambioEstado` → el cliente no ve que el radio creció.
- `calificar-servicio-page` y `dashboard-admin-page` sin actualización alguna.
- **Hydration/SSR**: proyecto aparte; el scaffolding muerto ya se removió (PR #54) y la rehidratación nunca estuvo habilitada (no hay `provideClientHydration()`).

## Constraints
- Backend: comentarios/JavaDoc/strings en **inglés**. Frontend: copy y comentarios en **español**.
- TDD standard. Runners: backend `cd backend && gradlew.bat test` (Docker Desktop debe estar corriendo); frontend `npm test -- --watch=false` (**baseline: 70 archivos / 604 tests**), `npx tsc -p tsconfig.app.json --noEmit` y `-p tsconfig.spec.json`, `npx eslint <tocados>` (8 errores preexistentes repo-wide).
- Un writer por tarea, secuencial. Rama `feat/sse-cobertura-ot` desde `origin/main` (`202ed5f`).
- **Deploy: Railway** (una instancia, el SSE verificado funcionando en producción) → el registry en memoria es **aceptable**; NO proponer broker/Redis.
- Push / PR / merge son decisiones del usuario.

## Authorized scope
Usuario (2026-10-16): *"en algunas partes del flujo de la OT sí falta esa actualización, haz una revisión y da los fixes necesarios para seguir con otras features"*.

## Acceptance criteria
- [ ] T1: al crearse una oferta, el stream del **técnico destinatario** recibe el evento (con test que lo pruebe); el endpoint queda autenticado por ticket y **limitado al propio técnico** (`/me`).
- [ ] T2: `ofertas-page` refresca al recibir el evento y **no pierde el poll** como respaldo (test).
- [ ] T3: las 3 páginas arrancan el poll de respaldo cuando el stream muere, no pollean mientras el stream está vivo, y lo cortan al destruirse (un test por página).
- [ ] T4: suites verdes (backend + frontend) + verificación independiente.

## Tasks
- [ ] T1 (backend, delegated): canal SSE por técnico. Route: delegated-direct.
- [ ] T2 (frontend, delegated): suscripción de la página de ofertas. Route: delegated-direct.
- [ ] T3 (frontend, delegated): fallback poll en ejecución / diagnóstico / pago-acta. Route: delegated-direct.
- [ ] T4 (parent): verificación final + reporte.

## Delivery
- Forecast: **~350–500 líneas** (T1 es el grueso: endpoint + namespace + evento + listener + tests). Estrategia `ask-on-risk` (default): si supera ~400, se decide con el usuario (cadena vs single PR).

## Progress
- 2026-10-16: doc creado en `feat/sse-cobertura-ot` (desde `origin/main` `202ed5f`). Revisión de cobertura hecha: matriz de páginas (SSE / poll / nada) + emisores actuales (solo 2 bridges, ambos keyed por OT). Confirmado con el usuario que el deploy es **Railway** y el SSE funciona en producción.
