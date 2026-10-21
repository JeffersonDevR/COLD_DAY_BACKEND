# Feature: alertas-ot

## Objective
Que el cliente y el técnico se enteren, sin recargar, de los momentos importantes de una orden: el técnico la acepta, el técnico manda el presupuesto, el cliente lo aprueba, el cliente paga la visita, el técnico llega, y le llega una oferta nueva. **Sin inventar un centro de notificaciones**: reusar los eventos que el dominio YA emite y los dos canales SSE que YA existen.

## Problem (mapeo verificado 2026-10-21)
Los eventos de dominio ya existen y **casi todos ya llegan al browser** por los canales que ya construimos; lo que falta es que **la UI los anuncie**:

- `OtEstadoCambiado` (drain del `save`, `OtRepositoryAdapter:86`) cubre BUSCANDO→EN_CAMINO→EN_DIAGNOSTICO→EN_REPARACION→FINALIZADA/CANCELADA → bridge `OtEstadoCambiadoSseListener`.
- `OtAsignada` (el técnico acepta, `AceptarOfertaUseCase:124`) → `OtAsignadaSseListener` (misma clave, mismo evento).
- `OfertaCreada` (`IniciarBusquedaTecnicoUseCase:91`) → `OfertaCreadaSseListener` (canal por técnico).
- `OtLlegadaConfirmada` (`ConfirmarLlegadaUseCase:61`) → `OtLlegadaConfirmadaSseListener`.
- El front hoy **recarga en silencio**: `seguimiento-ot-page.ts:166`, `ofertas-page.ts:52`, `ejecucion-ot-page.ts:250`. Los toasts existentes son **todos por acción del usuario** (`core/alertas/toast.service.ts:17-48`).

**Huecos reales:**
1. **El historial de la OT SÍ llega a la API** (`GET /api/ot/{id}/historial`, `OtController:133`) pero el mapper lo deja vacío (`backend.mappers.ts:193-194`) → el `OtTimeline` del cliente (`seguimiento-ot-page.html:244`) está **vacío contra el backend real** (solo los mocks lo llenan). Es el slot natural de un feed de actividad.
2. **El pago de la visita en `ASIGNADA` no cambia estado** (`Ot.registrarPagoVisita`, `Ot.java:676-688`) → **no hay evento** → el técnico nunca se entera de que le pagaron. Necesita evento + listener (misma clave, mismo nombre de evento → **sin cambio de contrato en el front**).
3. **`panel-tecnico-page` no tiene SSE** (solo poll) → la oferta nueva no llega si el técnico no está en la página de ofertas.

**Nota de producto:** "el cliente paga el presupuesto" **no existe como pago** — aprobar el presupuesto **es** el pago (el repo no tiene ese endpoint).

## Scope
- **T1 (backend, S):** poblar `historial` en la respuesta de la OT → el timeline del cliente se llena (sin tocar el front: el componente ya está enlazado).
- **T2 (backend, S-M):** evento de dominio + listener para **"el cliente pagó la visita"** (misma clave, mismo nombre de evento → sin cambio de contrato en el front).
- **T3 (frontend, S):** toasts para las alertas **ya entregadas**: aceptación del técnico, presupuesto enviado, presupuesto aprobado, llegada, oferta nueva.
- **T4 (frontend, S):** `panel-tecnico-page` abre el canal de ofertas (sin backend: el canal ya existe).
- **T5 (parent):** verificación final.

## Out of scope
- **Alertas de admin** (disputa abierta, liquidación registrada/aprobada/rechazada): no hay canal de admin ni listeners → canal nuevo (M/L).
- **Alertas globales del cliente** (`panel-cliente-page` solo pollea): requiere un canal por cliente.
- Cualquier sistema de notificaciones genérico (bandeja, push, email).

## Constraints
- Frontend: copy y comentarios en **español**; backend: inglés.
- TDD standard. Runners: backend `cd backend && gradlew.bat test` (Docker); frontend `npm test -- --watch=false` (baseline 73 archivos / 644 tests), `npx tsc -p tsconfig.app.json --noEmit` y `-p tsconfig.spec.json`, `npx eslint <tocados>` (8 errores preexistentes repo-wide).
- **Sin transporte nuevo**: todo debe entrar por los dos canales SSE que ya existen.
- Un writer por tarea, secuencial. Rama `feat/alertas-ot` desde `origin/main`.
- Push / PR / merge: decisión del usuario.

## Authorized scope
Usuario (2026-10-19, dentro de las 5 features pedidas): *"Implementación de alertas en las partes importantes de la orden de trabajo (cuando un técnico acepta una orden, cuando el cliente paga la visita o el presupuesto, cuando el técnico envía presupuesto u otros)"*.

## Acceptance criteria
- [ ] T1: la respuesta de la OT trae el historial → el timeline del cliente muestra la actividad real (hoy vacío).
- [ ] T2: el pago de la visita genera un evento que llega al técnico por el canal de la OT, sin cambiar el contrato del front.
- [ ] T3: las 5 alertas que ya llegan se anuncian con un toast en la página que corresponde.
- [ ] T4: el panel del técnico recibe la oferta nueva aunque no esté en la página de ofertas.
- [ ] T5: suites verdes + verificación independiente.

## Tasks
- [ ] T1 (backend, delegated): historial en la respuesta. Route: delegated-direct.
- [ ] T2 (backend, delegated): evento + listener del pago de la visita. Route: delegated-direct.
- [ ] T3 (frontend, delegated): toasts de las alertas ya entregadas. Route: delegated-direct.
- [ ] T4 (frontend, delegated): el panel técnico suscribe el canal de ofertas. Route: delegated-direct.
- [ ] T5 (parent): verificación final + reporte.

## Delivery
- Forecast: ~250–400 líneas (el grueso son los toasts y sus tests). Un PR, sin cadena.

## Progress
- 2026-10-21: doc creado tras el mapeo de eventos, bridges, canales y superficies (con `path:line`).
