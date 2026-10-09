# Feature: tecnico-activar-ubicacion

## Objective
Give the technician a button in the panel to start live location reporting, so the "Ubicación en vivo" requirement of the radar-visibility card stops being a dead end. Fix the backend half: expose the technician's own stored location freshness, and stop serving a stale GPS position as if it were live.

## Problem
The radar-visibility card (`panel-tecnico-page`) demands three things: `estadoValidacion = APROBADO`, `estadoOperativo = DISPONIBLE` and **live location**. But `TecnicoTrackingService.iniciar()` is only called from `ejecucion-ot-page`, i.e. only when the technician ALREADY has an assigned OT. Without an OT there is no location report, without a location report there is no radar visibility, and without radar visibility no OT arrives. The card's own hint ("se activa al ejecutar un servicio en curso") points at the state the technician cannot reach.

Two consequences observed in production (2026-10-09):
- The client's tracking page polls `GET /api/ot/{id}/tecnico-ubicacion` every 15 s and gets `404 "El técnico asignado aún no reporta ubicación"` forever.
- After a reload the card lies: `ubicacionReportando()` is purely local state, so a technician whose coordinates are already stored reads "No se está reportando".

## Why
The technician's own panel is the only place that can break the loop. Everything else (backend endpoint, spatial query, tracking service) already works.

## Scope
- Backend: `Tecnico` freshness rule + `ConsultarOtUseCase.ubicacionTecnico`; expose `ubicacion` / `ubicacionActualizadaEn` in `TecnicoResponse` → `TecnicoApiResponse` → mapper.
- Frontend: activate/stop buttons in the radar card; map the new fields; stop the unconditional 404 polling in `seguimiento-ot-page`.

## Constraints
- **User decision (2026-10-09):** the button starts LIVE tracking (`watchPosition` + throttled `PUT /api/tecnicos/me/ubicacion`), matching the "Ubicación en vivo" requirement wording. NOT a one-shot `getCurrentPosition`.
- The radar requirement stays strict: live reporting is what satisfies it. A stale stored coordinate is never presented as live.
- Backend contract preserved: `PUT /api/tecnicos/me/ubicacion` is body `{latitud, longitud}`, `204 No Content`; `GET /api/ot/{id}/tecnico-ubicacion` stays `404` when there is no vigent position.
- Idioma de artefactos: seguir la convención REAL de cada carpeta, no una regla global. `backend/` → comentarios, JavaDoc y strings en INGLÉS (así está escrito). `frontend/` → comentarios en ESPAÑOL y copy de UI en ESPAÑOL, igual que los archivos que se extienden. La conversación con el usuario va en español.
- TDD: Standard mode (no RED-before-GREEN ceremony). Ordinary functional checks.
- Runners: frontend `cd frontend && npm test` (Vitest 4 + jsdom, `--include`, NOT `--run`); backend `cd backend && gradlew.bat test`. Typecheck `npx tsc -p tsconfig.app.json --noEmit`; lint `npm run lint`.
- Delivery: `ask-on-risk` (default). Forecast ~250-350 authored lines, under the ~400 budget: no chaining expected.
- Branch: `fix/tecnico-activar-ubicacion`, based on `fix/panel-tecnico-visibilidad` (`d9b0b35`).
- Push / PR / merge remain user decisions under ordinary repository policy.

## Authorized scope
User authorized the fix ("dale un boton para que active la ubicacion que tiene") and chose the live-tracking semantics.

## Acceptance criteria
- [ ] T1: `Tecnico.reportaUbicacionVigente(ahora)` exists as a domain rule; `ConsultarOtUseCase.ubicacionTecnico` only returns a vigent position. Backend tests cover fresh / stale / never-reported.
- [ ] T2: `TecnicoResponse` + `TecnicoApiResponse` expose `ubicacion` and `ubicacionActualizadaEn`; mapper maps them; no other construction site breaks.
- [ ] T3: the radar card offers "Activar ubicación" / "Detener" and reflects the real tracking state; it distinguishes "never reported" from "stored but not live".
- [ ] T4: `seguimiento-ot-page` only polls the technician position when the OT actually has a technician assigned and is in a state where a live position exists.
- [ ] T5: frontend `npm test`, `tsc --noEmit`, `lint` and backend `gradlew test` green; each task closed with a work-unit commit.

## Tasks
- [ ] T1 (backend, delegated): freshness domain rule + use case — route: delegated-direct (writer trigger: 2+ non-trivial files across `tecnicos` and `ot`).
- [ ] T2 (backend, delegated): expose location freshness on the technician read model.
- [ ] T3 (frontend, delegated): activate/stop buttons + truthful radar card.
- [ ] T4 (frontend, delegated): gate the live-position polling.
- [ ] T5 (parent): verification + work-unit commits + final report.

## Progress
- 2026-10-09: feature doc created on `fix/tecnico-activar-ubicacion`.
