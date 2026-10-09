# Feature: sse-tiempo-real-ot

## Objective
Push server-side events to the browser in real time over Server-Sent Events, authenticated with a one-time ticket. Two consumers:
1. **Client** — OT state changes, so the OT page stops requiring a manual reload while it searches for a technician.
2. **Technician** — new offers, so a 60-second broadcast window is actually reachable.

## Problem
There is no push mechanism anywhere in the stack — verified: zero occurrences of `SseEmitter`, `text/event-stream`, `EventSource`, `WebSocket` or STOMP across `backend/` and `frontend/`. The only refresh mechanism is `interval()` polling plus the user reloading the page.

**Client side.** RF-F1-09 dispatches with a 60-second acceptance window and escalates the radius +5 km when nobody accepts; all of that happens server-side with no way to tell the client.

**Technician side (the acute one).** The offer flow is broken by design, and it is three compounding facts:

| Piece | Reality |
|---|---|
| Offer window | `VENTANA_BUSQUEDA = 60s` in `IniciarBusquedaTecnicoUseCase`; `OfertaOt.estaVigente` rejects anything past `expiraEn` |
| Push | `LoggingNotificacionPushAdapter` only logs. The port `NotificacionPushPort` exists and is documented as waiting for a real transport |
| Offers page | `ofertas-page.ts` loads once in the constructor; only `recargarOfertas()` is manual |

So the technician must be sitting on the offers page AND press reload within 60 seconds of the offer being created. Anywhere else in the app, they never learn about it. No amount of polling on that page fixes "the technician is on another screen" — the push is the missing piece.

There is also an upstream cause that is already fixed on a different branch: `IniciarBusquedaTecnicoUseCase.ejecutarOferta` creates one offer per technician returned by `buscarDisponiblesEnRadio`, whose SQL requires `activo AND estado_validacion='APROBADO' AND estado_operativo='DISPONIBLE'` and non-null coordinates. With no technician carrying coordinates, zero offers are created. `fix/tecnico-activar-ubicacion` gave the technician the button to start reporting their position; that branch is not merged or deployed.

## Why
The events already exist as an in-process seam (`ApplicationEventPublisher` is used by 15+ use cases), so the missing piece is transport, not domain modelling. And the offer window is a product requirement (RF-F1-09) that the current architecture cannot satisfy at all.

## Decision (user, 2026-10-09)
**One-time ticket authentication.** `POST /api/sse/ticket` (authenticated with the normal `Authorization` header) returns an opaque single-use code with a short TTL; the `EventSource` carries it as a query parameter. The JWT never reaches the access logs. Chosen over JWT-as-query-param (leaks a live bearer credential into Render's logs) and over HttpOnly cookies (an authentication migration: CORS credentials, `SameSite=None; Secure`, CSRF implications — far beyond this feature).

## The finding that shapes the design: a single choke point already exists

Every OT state transition, from every use case, flows through one loop:

```java
// OtRepositoryAdapter.save(Ot), line 52
for (CambioEstado cambio : ot.drenarCambiosPendientes()) {
    historialRepository.append(OtEstadoHistorial.registrar(ot.getId(), cambio));
}
```

The aggregate accumulates pending `CambioEstado` values and the adapter drains them on save. So a generic `OtEstadoCambiado` event can be published right there and it covers **every** transition — including the ones that have no event today.

That matters because the current event coverage is partial. Only these exist:

| Event | Published by | Covers |
|---|---|---|
| `OtCreada` | `CrearOtUseCase` | creation |
| `OtAsignada` | `AceptarOfertaUseCase` | the end of the client's wait |
| `OtCancelada` | `CancelarOtUseCase`, `RechazarPresupuestoUseCase` | cancellation |
| `OtFinalizada` | `FinalizarOtUseCase` | terminal |
| `OtSinTecnicosDisponibles` | `EscalarRadioUseCase` | terminal |

Everything else is silent: `IniciarDesplazamientoUseCase`, `ConfirmarLlegadaUseCase`, `RegistrarDiagnosticoUseCase`, `AprobarPresupuestoUseCase`, `RegistrarActaGarantiaUseCase`. Adding an event to each of those is 12 files that will drift apart. Publishing from the choke point is one place that cannot drift.

## Constraints
- **Publish AFTER COMMIT, never before.** `save()` calls `saveAndFlush` and then appends history — publishing inline would push a state that a later rollback erases, and the client would show an order state that never existed. Use `@TransactionalEventListener(phase = AFTER_COMMIT)`. This is not optional.
- Publishing from an infrastructure adapter is a deliberate compromise: the domain is supposed to own event publication. Document it in place and name the tradeoff, or move the drain loop's publication behind a domain-facing seam. Do not silently break the layering rule.
- The ticket proves identity, NOT authorization. On stream open the code must still resolve the OT and enforce the same rule as `OtController`: `AutorizacionPropietario.exigirParticipanteOAdmin`. A ticket for technician A must not stream technician B's order.
- Emitter lifecycle: remove every emitter from the registry in `onCompletion`, `onTimeout` AND `onError`. This is the classic leak — miss one and dead connections accumulate until the instance dies.
- Heartbeat required: a periodic comment/`ping` event so intermediaries do not close an idle stream. Tune the emitter timeout accordingly.
- `SecurityConfig` must `permitAll` ONLY `GET` on the stream path (the ticket is the credential). `POST /api/sse/ticket` stays authenticated under the default `anyRequest().authenticated()` rule. Do not widen `permitAll` beyond the stream path.
- In-process registry is correct for ONE instance. On more than one Render instance the events are local to the process and split-brain: a client connected to instance A never sees a transition that happened on instance B. Redis pub/sub is required to scale out. Decide before scaling, not after.
- Render's proxy must not buffer the response. SSE passes, but if events arrive in bursts rather than one by one, suspect the proxy before the code.
- Comment language: `backend/` English, `frontend/` Spanish, UI copy Spanish.
- TDD: Standard mode.
- Runners: backend `cd backend; .\gradlew.bat test` (Docker for Testcontainers); frontend `npm test` (Vitest, `--include`), `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`.
- Delivery: `ask-on-risk`. Forecast: this is the largest of the three features — expect to be near or over the 400-line budget. Split into chained PRs if the tasks phase confirms it: (1) backend transport + ticket + registry, (2) frontend client + OT page wiring.
- WebSocket/STOMP is explicitly rejected: the traffic is server-to-client, and client actions already work over REST.

## Authorized scope
User asked for SSE implementation to fix the recurring need to reload the OT page while it searches for technicians, and chose the ticket authentication model.

## Acceptance criteria
- [x] T1: `POST /api/sse/ticket` returns a single-use, short-TTL opaque ticket bound to the caller; it cannot be replayed and expires. — SHA-256 at rest via `TokenGeneratorPort`; `consumir` removes before validating, so a replay fails even concurrently; scheduled purge reclaims never-presented tickets. IT covers 401 for invalid and the double-use rejection.
- [x] T2: `GET` stream endpoint accepts `?ticket=`, validates it, enforces OT participation, and streams events for that order. — `OtStreamController` consumes the ticket, builds the identity, then applies `exigirParticipanteOAdmin`. IT proves a technician cannot stream another technician's order.
- [x] T3: every OT transition reaches the stream, including the ones with no domain event today. Proven by `aTransitionWithoutADomainEventReachesTheStream`, a real MockMvc SSE test that opens the stream, drives `iniciarDesplazamiento` (no domain event exists for it) and reads `EN_CAMINO` off the response body. — Note: `ConfirmarLlegada` and `RegistrarActaGarantia` produce no `CambioEstado` at all (facts on an unchanged state), so they correctly emit nothing.
- [x] T4: emitters are removed on completion, timeout and error; no unbounded growth. — `SseEmitterRegistry.crear` owns creation and wires all three callbacks, so they cannot be forgotten; 10 unit tests cover each path plus the heartbeat sweep.
- [ ] T5: events are published only after commit; a rolled-back transition emits nothing.
- [ ] T6: the client's OT page updates without a manual reload when the order is assigned, cancelled or finalized.
- [ ] T7: a new offer reaches the technician's stream the moment it is created, without the technician being on the offers page.
- [ ] T8: the frontend recovers from a dropped connection by fetching a NEW ticket and recreating the `EventSource`.
- [ ] T9: both suites green, `tsc` and lint clean, work-unit commits.

## Slice plan (forecast exceeds the ~400-line delivery budget)
1. **Slice 1 — backend transport.** Ticket issuance/consumption, emitter registry, stream endpoint, `SecurityConfig` narrowing, `OtEstadoCambiado` published from the choke point. Verifiable by backend tests alone; no frontend consumer yet.
2. **Slice 2 — frontend client + client's OT page.** SSE service (ticket, `EventSource`, reconnect with a fresh ticket, backoff, teardown) and the OT page wiring. Delivers real-time OT state end-to-end.
3. **Slice 3 — offers.** Backend emits the new offer to the technician's stream and the offers page consumes it. This is the slice that fixes the reported pain.

## Tasks
- [ ] T1 (backend): ticket issuance + single-use store with TTL (reuse `SecureRandomTokenGenerator`; hash at rest to match the reset-token house style).
- [ ] T2 (backend): emitter registry + stream controller + `SecurityConfig` narrowing.
- [ ] T3 (backend): `OtEstadoCambiado` published from the choke point via `@TransactionalEventListener(AFTER_COMMIT)`.
- [ ] T4 (backend): tests — replay rejection, expiry, cross-order authorization refusal, silent-transition coverage, emitter cleanup.
- [ ] T5 (frontend): SSE client service (ticket fetch, `EventSource`, reconnect with a fresh ticket, backoff, teardown).
- [ ] T6 (frontend): wire the OT page to the stream; keep polling as a fallback only where it still earns its place.
- [ ] T7 (backend): publish the created offer to the technician's stream.
- [ ] T8 (frontend): wire the offers page to the stream.
- [ ] T9 (parent): verification, commits, report.

## Known gotchas to hand to the implementer
1. **`EventSource` auto-reconnect is actively harmful here.** Its built-in retry re-requests the same URL, whose ticket is already burned, producing a 401/403 loop. The client must close the source on error and recreate it with a fresh ticket, with backoff. Do not rely on the native reconnect.
2. **`GET` stream path vs `EventSource` and CORS.** `EventSource` is a simple request; it cannot set headers and does not send credentials unless asked. The ticket must travel in the query string.
3. **Ticket TTL vs stream duration.** The ticket is validated at open, not for the life of the stream. A long-lived stream outlives its ticket — that is intended, but say so explicitly so nobody "fixes" it by re-validating mid-stream.
4. **Tests must not hang.** An SSE integration test that opens a stream and waits will block the suite. Use a bounded timeout and assert on the first event.

## Progress
- 2026-10-09: feature doc created. Not started — two other features were in flight on the same working tree.
- 2026-10-09: rebased onto a clean `main` after `fix/tecnico-activar-ubicacion` merged (PRs #26 and #27). Branch `feat/sse-tiempo-real` from `b505dc1`, diff against `origin/main` empty.
- 2026-10-09: **Slice 1 done.** Transport delivered: ticket service, ticket endpoint, emitter registry, `GET /api/ot/{id}/stream`, `OtEstadoCambiado` published from the drain choke point, `SecurityConfig` narrowed to `GET /api/ot/*/stream`. Backend suite **100 classes / 730 tests / 0 failures / 0 errors / 0 skipped** (baseline 703, +27: 24 new feature tests across 4 new classes plus 3 dynamic ones from the new endpoints and the allowlist entry).

## Verification notes (slice 1)
- The parent's first `gradlew test` returned **`UP-TO-DATE`** and executed nothing. That is a false green: Gradle skipped the task because the inputs were unchanged since the worker's run. It was re-run as `cleanTest test --rerun-tasks` (7 tasks executed, BUILD SUCCESSFUL, 4m35s) before any verification claim was made. Do not accept `UP-TO-DATE` as evidence.
- `SecureRandomTokenGenerator` actually lives in `core/modules/usuarios/infrastructure/security/`, NOT in `core/shared/infrastructure/security/` as the delegation prompt stated. The worker did not follow the wrong path blindly: it reused the class through its `TokenGeneratorPort` interface, which is the injection point `RecuperarContrasenaUseCase` already uses.
- Deviation accepted: `RutasPublicas.EXACTAS` (test-only allowlist) gained `GET /api/ot/{id}/stream`. `EndpointsProtegidosTest` probes every endpoint anonymously with a placeholder path variable, and `@PathVariable OtId` fails UUID binding (400) before the ticket check runs, so the endpoint cannot self-report 401. The entry is honest — the path really is public by design — and `SseOtStreamIT` covers the 401 for an invalid ticket. No production rule was widened.
- Unexplained build detritus: `org/springframework/web/servlet/mvc/method/annotation/{ResponseBodyEmitter$DataWithMediaType,SseEmitter$SseEventBuilderImpl}.class` appeared at the **repository root** (mtime 15:06, the worker's run; not reproduced by the forced run). Two private inner classes of Spring, i.e. compiled from Spring's own source. Cause not determined. Deleted; it is not source and must never be committed. The root `.gitignore` does not cover it — worth adding, but that file is already modified by another session and was deliberately left untouched.

## Risks carried into later slices
- `OtEstadoCambiado` is published from an infrastructure adapter (documented compromise in place). **`intentarAsignar` bypasses `save(Ot)`** and therefore does not emit it — assignment still emits the dedicated `OtAsignada`, so the stream has coverage, but a future consumer must not assume every state change flows through the drain loop.
- In-memory tickets and emitters are per-instance. A multi-instance deployment needs sticky routing or a shared store.
- No emitter cap or per-key fan-out limit yet; consider one before production, plus explicit registry cleanup on shutdown (`limpiar()` exists and is currently used only by tests).

## Out of scope / follow-ups
- Replacing the remaining `interval()` polling wholesale. `seguimiento-ot-page` still polls the technician position every 15 s by design (that is a high-frequency numeric stream, a different problem from discrete state changes).
- Redis pub/sub for multi-instance fan-out. Required before scaling out; deliberately deferred.
- Persisting events for `Last-Event-ID` replay after a reconnect gap. Not needed while the client reloads the order on (re)connect.
- A real push transport for offline technicians (FCM/APNs). SSE only helps while the tab is open; the 60-second window is still missed by a technician whose phone is in their pocket. That is inherent to RF-F1-09 and needs a mobile push channel, not SSE.
- **Prerequisite, different branch:** `fix/tecnico-activar-ubicacion` must be merged and deployed, otherwise zero offers are created and SSE will faithfully stream nothing.
