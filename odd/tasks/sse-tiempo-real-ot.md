# Feature: sse-tiempo-real-ot

## Objective
Push OT state changes to the browser in real time so the client's OT page stops requiring a manual reload while it searches for a technician. Server-Sent Events, authenticated with a one-time ticket.

## Problem
There is no push mechanism anywhere in the stack — verified: zero occurrences of `SseEmitter`, `text/event-stream`, `EventSource`, `WebSocket` or STOMP across `backend/` and `frontend/`. The only refresh mechanism is `interval()` polling plus the user reloading the page.

That is worst exactly where it hurts most. RF-F1-09 dispatches with a 60-second acceptance window and escalates the radius +5 km when nobody accepts; all of that happens server-side with no way to tell the client. The client stares at a stale screen.

## Why
The events already exist as an in-process seam (`ApplicationEventPublisher` is used by 15+ use cases), so the missing piece is transport, not domain modelling.

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
- [ ] T1: `POST /api/sse/ticket` returns a single-use, short-TTL opaque ticket bound to the caller; it cannot be replayed and expires.
- [ ] T2: `GET` stream endpoint accepts `?ticket=`, validates it, enforces OT participation, and streams `OtEstadoCambiado` events for that order.
- [ ] T3: every OT transition reaches the stream, including the ones with no domain event today (`EN_CAMINO`, arrival, diagnosis, budget approval, acta). Proven by a test that drives at least one previously-silent transition.
- [ ] T4: emitters are removed on completion, timeout and error; no unbounded growth.
- [ ] T5: events are published only after commit; a rolled-back transition emits nothing.
- [ ] T6: the client's OT page updates without a manual reload when the order is assigned, cancelled or finalized.
- [ ] T7: the frontend recovers from a dropped connection by fetching a NEW ticket and recreating the `EventSource`.
- [ ] T8: both suites green, `tsc` and lint clean, work-unit commits.

## Tasks
- [ ] T1 (backend): ticket issuance + single-use store with TTL (reuse `SecureRandomTokenGenerator`; hash at rest to match the reset-token house style).
- [ ] T2 (backend): emitter registry + stream controller + `SecurityConfig` narrowing.
- [ ] T3 (backend): `OtEstadoCambiado` published from the choke point via `@TransactionalEventListener(AFTER_COMMIT)`.
- [ ] T4 (backend): tests — replay rejection, expiry, cross-order authorization refusal, silent-transition coverage, emitter cleanup.
- [ ] T5 (frontend): SSE client service (ticket fetch, `EventSource`, reconnect with a fresh ticket, backoff, teardown).
- [ ] T6 (frontend): wire the OT page to the stream; keep polling as a fallback only where it still earns its place.
- [ ] T7 (parent): verification, commits, report.

## Known gotchas to hand to the implementer
1. **`EventSource` auto-reconnect is actively harmful here.** Its built-in retry re-requests the same URL, whose ticket is already burned, producing a 401/403 loop. The client must close the source on error and recreate it with a fresh ticket, with backoff. Do not rely on the native reconnect.
2. **`GET` stream path vs `EventSource` and CORS.** `EventSource` is a simple request; it cannot set headers and does not send credentials unless asked. The ticket must travel in the query string.
3. **Ticket TTL vs stream duration.** The ticket is validated at open, not for the life of the stream. A long-lived stream outlives its ticket — that is intended, but say so explicitly so nobody "fixes" it by re-validating mid-stream.
4. **Tests must not hang.** An SSE integration test that opens a stream and waits will block the suite. Use a bounded timeout and assert on the first event.

## Progress
- 2026-10-09: feature doc created. Not started — two other features are in flight on the same working tree.

## Out of scope / follow-ups
- Replacing the remaining `interval()` polling wholesale. `seguimiento-ot-page` still polls the technician position every 15 s by design (that is a high-frequency numeric stream, a different problem from discrete state changes).
- Technician offer notifications over SSE. Natural second consumer of the same transport; not in this scope.
- Redis pub/sub for multi-instance fan-out. Required before scaling out; deliberately deferred.
- Persisting events for `Last-Event-ID` replay after a reconnect gap. Not needed while the client reloads the order on (re)connect.
