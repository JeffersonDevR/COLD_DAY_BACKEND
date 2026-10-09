# Feature: ofertas-tecnico-ot-anidada

## Objective
Fix the technician's offers page, which showed nothing, by embedding a reduced order summary in the offers response so the page never calls `GET /api/ot/{id}` for an offer.

## Problem
`GET /api/tecnicos/me/ofertas` returned offers without the order nested, so `TecnicosApi.getOfertasParaTecnico` fetched `GET /api/ot/{otId}` once per offer inside a `forkJoin`.

But `GET /api/ot/{id}` enforces `AutorizacionPropietario.exigirParticipanteOAdmin`, and **holding a PENDING offer is not participation** — only the admin, the owning client, or the already-assigned technician qualify. Every offer therefore returned **403**, and `forkJoin` fails fast, so the entire list was lost.

Diagnosed from a live `403` in the browser console on `GET /api/ot/{uuid}`.

## Why
The offers page is the technician's entry point to work. With it empty, no technician can ever accept an order — the whole dispatch flow is dead from the technician's side.

## Timeline (this is not a new regression)
```
32f9ba7  2026-10-01  fix(security): enforce participation on the OT read paths
f3abbfe  2026-10-06  refactor(pages): move the tecnicos pages and services into the target layout
```
The participation guard landed **first**; the frontend composition was moved on top of it afterwards. The composition has been incompatible with the authorization rule since the guard exists. Unrelated to the SSE work.

## Decision (user, 2026-10-09)
**Nest the order in the offers response.** Chosen over "let an offer holder read the order" because the offers endpoint is already scoped to the technician's own offers, so **no authorization rule is widened**, and it also removes an N+1 (the page made 1 + N requests; now 1).

## Constraints
- The nested order is a **reduced summary, not the full `OtApiResponse`**. The holder of a pending offer is not yet a participant, so the summary excludes `actaCodigoVerificacion`, `diagnostico`, `presupuesto`, `clienteId`, `tarifaVisita`, `medioPagoVisita`, `actaFirmada`, `calificacion*`. Coordinates ARE included: the street address is already there, so they leak nothing extra.
- **Rule for future fields, documented in the record's JavaDoc:** any field added must be justified against "the holder is not yet a participant".
- `AutorizacionPropietario` must not change — that is the point of the chosen fix.
- Additive only on the wire: every existing offer field keeps its name and meaning.
- Comment language: `backend/` English, `frontend/` Spanish.

## Acceptance criteria
- [x] T1: `GET /api/tecnicos/me/ofertas` carries the nested reduced order per offer; authorization untouched.
- [x] T2: a test proves the summary does **not** leak the participant-only fields (asserts nine absent fields).
- [x] T3: the frontend maps the nested order and makes a **single** request; a regression guard asserts no call to `/api/ot/...`.
- [x] T4: both suites green, `tsc` and lint clean.

## Verification
- Backend, parent-run: **100 classes / 732 tests / 0 failures / 0 errors / 0 skipped** (baseline 731, +1). `OfertaApiIT` 8/8 including `theNestedOrderSummaryDoesNotLeakFieldsReservedForParticipants`.
- Frontend: `tsc` exit 0, **65 files / 465 tests**, lint clean (baseline 464, +1).

## Integration gap found and fixed by the parent
The two workers disagreed on one case and neither covered it. The backend keeps a defensive branch that emits **`ot: null`** for an offer whose order could not be resolved, and documented "the frontend renders only offers that carry an order" — but the frontend mapper dereferenced `dto.ot.id` unconditionally, so a single null order would have thrown and killed the list again. The DTO also lied: it typed `ot` as non-null.

Fixed by making the type honest (`ot: OfertaOtResumenApiResponse | null`), filtering with a type predicate, and naming the narrowed contract:

```ts
export type OfertaOtConResumen = OfertaOtApiResponse & { ot: OfertaOtResumenApiResponse };
```

`aOfertaTecnico` now requires `OfertaOtConResumen`, so calling it with an order-less offer is a compile error rather than a runtime crash.

**Process note:** the parent's first attempt at this fix passed its own new tests but did not compile (8 × `TS18047 'dto.ot' is possibly null`), and after fixing that, ESLint caught 2 imports left unused by the same edit — which `tsc` did not flag. Both tools are required; neither alone is sufficient.

## Out of scope / follow-ups
- `OfertaOtResumenApiResponse.latitud`/`longitud` are `Double` (nullable) while the frontend types them as `number`. Only reachable if an order had no coordinates, which `Ot.crear` prevents with `@NotNull`, and the offer card does not read them. Cosmetic; a two-line follow-up.
- `clienteNombre` is resolved per distinct client rather than batched (no batch port on `ClienteRepository`/`UsuarioRepository`). Acceptable at the current live-offer count; revisit if it grows.
