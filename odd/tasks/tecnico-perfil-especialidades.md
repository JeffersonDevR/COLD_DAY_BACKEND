# Feature: tecnico-perfil-especialidades

## Objective
Give the technician a real profile page: shows their full name, email and identification, and lets them add and remove their service specializations. The backend gains a self-service endpoint scoped to the authenticated principal, following the module's existing `/me/*` convention.

## Problem
There is no technician profile screen. `app.menu.ts` offers *Mi Panel*, *Radar de Ofertas*, *Documentación* and *Liquidaciones*; `perfil-documentos-page` is only the document/vigencia expediente — no name, no email, no specializations.

The only surface that could edit a technician is `PUT /api/tecnicos/{id}`, and its contract actively blocks the requested operations:

| Defect | Evidence | Consequence |
|---|---|---|
| `@NotBlank String password` required | `TecnicoApiRequest:16` | Adding a specialization demands sending a password |
| `@NotEmpty Set<CategoriaServicio>` | `TecnicoApiRequest:20` | Cannot remove the last specialization |
| `@NotNull Boolean aceptaHabeasData` | `TecnicoApiRequest:22` | Mandatory on every edit even when unchanged |
| `correo` accepted then silently dropped | `TecnicoMapper.apply` calls `usuario.actualizarPerfil(nombre, telefono, fotoUrl)` — no correo | "Edit my email" would not work even with a UI |
| `password` required and never used | same mapper; `ActualizarTecnicoUseCase` never reads it | Dead required field on the wire |

`TecnicoApiRequest` is shared by `POST /` (registration) and `PUT /{id}`, so the dead `password` cannot simply be removed without splitting the DTO — deliberately out of scope, tracked as a follow-up.

## Why
The technician cannot manage their own specializations, and those specializations are exactly what the client's radar filters on (`coincideCategoria` in `PostgisTecnicoDisponibilidadAdapter`). A technician who cannot declare a new specialty cannot receive those orders at all.

## Scope
- Backend: domain rule + self-service endpoint + its own request/response path and tests.
- Frontend: new page, route, menu entry, API method with mock parity, specs.

## Constraints
- **User decision (2026-10-09):** specializations are a plain `Set<CategoriaServicio>` — add and remove, with the invariant that the technician can never end up with zero. **No Flyway migration, no change to the aggregate's persistence shape.** "Desactivar" therefore means "remove from the set".
- New endpoint is owner-only and resolves the technician from the principal, never from a path variable — the module's documented `/me/*` convention (`/me/estado`, `/me/ubicacion`). There must be no `{id}` to tamper with.
- The new endpoint must NOT reuse `TecnicoApiRequest`: that record's `password`/`habeasData` requirements are registration concerns. Add a dedicated request.
- Minimum one specialization is enforced at BOTH layers: `@NotEmpty` on the request (400 via the existing `MethodArgumentNotValidException` handler) and a domain guard (defence in depth).
- `Tecnico.reemplazarCategorias` must stay permissive: `Tecnico.crear(...)` with `Set.of()` and `reconstituir(...)` are used across ~20 existing tests. Add a separate, guarded method for the self-service path instead of tightening the existing one.
- Email is DISPLAY-ONLY. Changing a login email is an identity operation needing its own verification flow; not requested and deliberately excluded.
- Error mapping: follow `TecnicoControllerAdvice`; a new domain exception for the zero-specialization rule maps to `400 BAD_REQUEST`.
- Comment language follows each folder's real convention: `backend/` English, `frontend/` Spanish, UI copy Spanish.
- TDD: Standard mode.
- Runners: backend `cd backend; .\gradlew.bat test` (needs Docker for Testcontainers); frontend `npm test` (Vitest, `--include`, NOT `--run`), `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`.
- Delivery: `ask-on-risk`. Forecast ~300-400 authored lines; if the estimate crosses 400 the orchestrator re-evaluates before continuing.
- Branch: `fix/tecnico-activar-ubicacion` (continue on it) — or a fresh branch if the previous one is merged first. Orchestrator decides at commit time.

## Authorized scope
User asked for the profile page ("algo que realmente esta faltando es el perfil del tecnico... nombre completo, correo y pueda agregar, quitar o desactivar las especializaciones") and answered the blocking design question. Push / PR / merge stay user decisions.

## Acceptance criteria
- [ ] T1: `Tecnico` exposes a guarded specialization update that rejects an empty or null set; `reemplazarCategorias` unchanged and all existing tests still green.
- [ ] T2: `PUT /api/tecnicos/me/perfil` is owner-scoped, resolves the technician from the principal, returns the updated profile, and rejects an empty specialization set with 400. No path `{id}`.
- [ ] T3: `/tecnico/perfil` renders full name, email, identification and current specializations, and lets the technician add/remove them with a save action; it prevents saving an empty selection client-side and surfaces the backend 400 honestly. — DONE, commit pending
- [ ] T4: menu entry + route + `TecnicosApi` method with mock parity; specs cover save, blocked-empty and error paths. — DONE, commit pending
- [ ] T5: both suites green, `tsc` and lint clean, each task closed with a work-unit commit.

## Tasks
- [ ] T1 (backend, delegated): domain rule for specialization updates.
- [ ] T2 (backend, delegated): self-service endpoint + request DTO + use case + advice mapping.
- [ ] T3 (frontend, delegated): the profile page.
- [ ] T4 (frontend, delegated): route, menu, API method, mocks, specs.
- [ ] T5 (parent): verification, commits, report.

## Progress
- 2026-10-09: feature doc created.

## Out of scope / follow-ups
- `TecnicoApiRequest` is overloaded between registration and update; splitting it (and killing the dead `password` on the update path) is a separate, contract-changing commit.
- The admin `PUT /{id}` path is left untouched: it still requires a password it never reads.
- Editing name, phone or email is not in scope. If email editing is ever wanted it needs a verified-change flow, not a plain PUT.
- Client-side radar freshness was addressed in `tecnico-activar-ubicacion`; the PostGIS eligibility query still does not filter on freshness.
