# Apply Progress: add-proveedores-auxiliares

Change: `add-proveedores-auxiliares` · Store: `openspec` · Mode: Standard (`rules.apply.tdd: false`, no `strict_tdd` marker)
Slices: **1 — Tariff calculator** (PR 1, committed `b45fd60`) + **2 — Estimate endpoint** (PR 2, committed `635db3e`) + **3 — Authoritative tariff persistence** (PR 3, committed `e9bb926`) + **4 — Auxiliar persistence** (PR 4, committed `bea0671`) + **5 — Auxiliar accept API** (PR 5, committed `8ab5ff0`) + **6 — Proveedor identity** (PR 6, this attempt) · Chain strategy: `stacked-to-main`

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 1.1 | Pure `CalculadoraTarifaVisita`: inclusive metro base, absolute-distance marginal brackets, pre-rounding cap, `redondeoCop` rounding, out-of-range, `banda` 0..4 | `[x]` |
| 1.2 | Tariff VOs and `@ConfigurationProperties` binding; `app.tarifa.*` defaults | `[x]` |
| 1.3 | Unit tests: base at 3/8 km, just-beyond, continuity at 12/18/24, cap at 28.375, `d>30` out-of-range, `banda` boundaries, rounding | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/src/main/java/com/sena/cold_day/core/modules/ot/domain/services/CalculadoraTarifaVisita.java` | Created | Pure calculator: flat inclusive metro base, absolute-distance marginal brackets, cap before rounding, COP rounding |
| `backend/src/main/java/com/sena/cold_day/core/modules/ot/domain/valueobjects/TarifaFuente.java` | Created | `ROAD` \| `LINEAL` source value object |
| `backend/src/main/java/com/sena/cold_day/core/modules/ot/domain/valueobjects/BandaTarifa.java` | Created | Half-open `[desdeKm, hastaKm)` bracket with validated `rateCop` |
| `backend/src/main/java/com/sena/cold_day/core/modules/ot/domain/valueobjects/TarifaEstimada.java` | Created | Result VO: distance, source, band, tariff, out-of-range invariant |
| `backend/src/main/java/com/sena/cold_day/core/modules/ot/infrastructure/config/TarifaProperties.java` | Created | `@ConfigurationProperties(prefix = "app.tarifa")` with declared defaults and `aCalculadora()` |
| `backend/src/main/java/com/sena/cold_day/core/modules/ot/infrastructure/config/TarifaConfig.java` | Created | `@EnableConfigurationProperties(TarifaProperties.class)` (mirrors `MapsConfig`) |
| `backend/src/main/resources/application.properties` | Modified | Added the `app.tarifa.*` keys, env-overridable |
| `backend/src/test/java/com/sena/cold_day/core/modules/ot/domain/services/CalculadoraTarifaVisitaTest.java` | Created | 23 tests over the tariff table and invariants |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*CalculadoraTarifaVisitaTest'` → `BUILD SUCCESSFUL`; `tests="23" failures="0"` (from `build/test-results/test/TEST-...CalculadoraTarifaVisitaTest.xml`) |
| Runtime harness command/scenario and exact result | **N/A** — this slice is a pure domain service with no Spring/DB/network boundary. Supplementary config-binding proof: `./gradlew test --tests '*ColdDayApplicationTests'` → `BUILD SUCCESSFUL` (the application context loads with `TarifaConfig`/`TarifaProperties` bound). |
| Rollback boundary | `CalculadoraTarifaVisita`, `TarifaFuente`, `BandaTarifa`, `TarifaEstimada`, `TarifaProperties`, `TarifaConfig`, `CalculadoraTarifaVisitaTest`, and the `app.tarifa.*` block in `application.properties`. No schema, no `ot` aggregate, no existing behavior is touched. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*CalculadoraTarifaVisitaTest'` → **BUILD SUCCESSFUL**, 23 tests / 0 failures

## Budget

379 changed lines (additions + deletions, authored) — within the 400-line review budget. No `size:exception` needed for this slice.

## Deviations from Design

- **None** in behavior or structure; implementation matches AD9/AD10/AD13 scope (AD13's `TARIFA_VISITA_BASE` deletion is slice 3, correctly untouched).
- **Process note:** `openspec/changes/add-proveedores-auxiliares/tasks.md` was **not** edited. The orchestrator declared the planning artifacts read-only for this slice, and that file is table-based (it contains no `- [ ]` checkboxes). Completion is recorded here instead.

## Out of Scope (do not absorb)

- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- Slices 3–14: persistence, auxiliares, proveedores, despacho-insumos, frontend surfaces, schema.

---

# Slice 2 — Estimate endpoint (PR 2 of the chained/stacked delivery)

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 2.1 | Non-throwing `MapsUseCase.distanciaOpcional` (disabled/unconfigured/empty/thrown → `Optional.empty()`, never 503) | `[x]` |
| 2.2 | `EstimarTarifaUseCase` + `TarifaApiRequest` + `TarifaEstimadaResponse` + `TarifaController` (`POST /api/ot/tarifa/estimar`, HTTP 200 out-of-range) | `[x]` |
| 2.3 | Frontend contract lockstep for the estimate DTO + mapper (read-only, no UI page) | `[x]` |
| 2.4 | Tests: ROAD used; LINEAL on disabled/unconfigured/empty/throws; read-only estimate; malformed 400; out-of-range 200 with explicit nulls; configured center reaches the fallback | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../maps/application/usecases/MapsUseCase.java` | Modified | Added `distanciaOpcional`: `usable()` guard + try/catch → `Optional.empty()`; `distancia(...)` keeps its 503 |
| `backend/.../ot/application/usecases/EstimarTarifaUseCase.java` | Created | Maps road distance → `ROAD`, else Haversine with the configured center → `LINEAL` |
| `backend/.../ot/infrastructure/api/requests/TarifaApiRequest.java` | Created | `{latitud, longitud}` with Bean Validation ranges (400 on malformed) |
| `backend/.../ot/infrastructure/api/responses/TarifaEstimadaResponse.java` | Created | Five-field record mirroring the design (explicit nulls out of range) |
| `backend/.../ot/infrastructure/api/controllers/TarifaController.java` | Created | `POST /api/ot/tarifa/estimar`, `isAuthenticated`, read-only |
| `backend/.../ot/infrastructure/api/controllers/OtControllerAdvice.java` | Modified | `TarifaController` added to `assignableTypes` so validation reuses the canonical 400 `ApiError` |
| `backend/.../test/.../maps/application/usecases/MapsUseCaseTest.java` | Created | 6 tests over the non-throwing contract |
| `backend/.../test/.../ot/application/usecases/EstimarTarifaUseCaseTest.java` | Created | 4 tests: ROAD, LINEAL fallback with configured/default center, out-of-range |
| `backend/.../test/.../ot/infrastructure/api/controllers/TarifaApiIT.java` | Created | 5 tests: valid, bracket, out-of-range nulls, malformed 400, unauthenticated 401 |
| `frontend/.../domain/models/common.models.ts` | Modified | `TarifaFuente` type + `TarifaEstimadaResponse` view model |
| `frontend/.../infrastructure/api/backend.dto.ts` | Modified | `TarifaEstimarApiRequest` + `TarifaEstimadaApiResponse` |
| `frontend/.../infrastructure/api/backend.mappers.ts` | Modified | `aTarifaEstimadaResponse` mapper |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*MapsUseCaseTest' --tests '*TarifaApiIT'` → `BUILD SUCCESSFUL`; `MapsUseCaseTest` 6/0 failures, `TarifaApiIT` 5/0 failures. Extra: `*EstimarTarifaUseCaseTest` → 4/0 failures. |
| Runtime harness command/scenario and exact result | `cd backend && ./gradlew bootRun` + authenticated `POST /api/ot/tarifa/estimar`: valid `{7.8939,-72.5078}` → **200** `{"distanciaKm":0.0,"tarifaFuente":"LINEAL","banda":0,"tarifa":30000,"fueraDeRango":false}`; out-of-range `{0,0}` → **200** `{"distanciaKm":8081.5,"tarifaFuente":"LINEAL","banda":null,"tarifa":null,"fueraDeRango":true}`; malformed (missing `longitud`) → **400**; unauthenticated → **401**. Maps key absent, so the LINEAL fallback path executed for real. |
| Rollback boundary | `MapsUseCase.distanciaOpcional`, `EstimarTarifaUseCase`, `TarifaApiRequest`, `TarifaEstimadaResponse`, `TarifaController`, the `OtControllerAdvice` `assignableTypes` edit, the three test files, and the three frontend contract additions. No `Ot` aggregate, schema, DB column or persistence path is touched. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*MapsUseCaseTest' --tests '*TarifaApiIT'` → **BUILD SUCCESSFUL**, 11 tests / 0 failures
3. `cd frontend && npm run build` → **BUILD SUCCESSFUL** (the installed `node_modules` was stale — missing `primeng`/`primeicons`; `npm ci` restored the lockfile deps with **no tracked-file change**, so this was an environment repair, not a code defect)

## Budget

**Slice 2 authored: 534 changed lines** (67 additions + 1 deletion tracked, plus 466 lines across 7 new files) — over the orchestrator's 500-line hard budget. Slice 1 was 379. One honest slicing pass found no cohesive split: tests must travel with their unit (work-unit-commits), and the frontend contract files cannot trail the API (constraint 10). Trimming would mean deleting tests/coverage, which the review-budget rule forbids. **`size:exception` recommended for PR 2.**

## Deviations from Design

- **None in behavior.** `TarifaController` reuses the existing `OtControllerAdvice` via `assignableTypes` instead of adding a new advice, keeping the canonical `ApiError` 400 shape without a new file.
- **Carry-over fix (slice 1):** the Haversine fallback reads `TarifaProperties.centroLat/centroLng`, so the `0 → default` substitution now reaches a real center; covered by `EstimarTarifaUseCaseTest.usaElCentroPorDefectoCuandoLaConfiguracionNoLoDefine`.

## Out of Scope (do not absorb)

- Slices 3–14: persistence, auxiliares, proveedores, despacho-insumos, frontend surfaces, schema.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.

---

# Slice 3 — Authoritative tariff persistence (PR 3 of the chained/stacked delivery)

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 3.1 | `Ot.distanciaKm`/`Ot.tarifaFuente` fields + `registrarTarifaVisita(...)`; **deleted** `Ot.TARIFA_VISITA_BASE` (AD13); `reconstituir` keeps a 19-arg delegating overload (21-arg canonical) | `[x]` |
| 3.2 | Mapped the two nullable columns in `OtJpaEntity`; mirrored in `schema.sql` in lockstep (`OtRepositoryAdapter` needed no change — mapping lives in the JPA entity) | `[x]` |
| 3.3 | Computed + persisted the authoritative tariff on finalize and on non-free-window cancel, plus the budget-rejection cancellation (the other reader of the deleted constant) | `[x]` |
| 3.4 | Tests: persisted on finalization/cancellation, acceptance persists nothing, config override changes the price with no schema change | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../ot/domain/aggregates/Ot.java` | Modified | Added `distanciaKm`/`tarifaFuente` + `registrarTarifaVisita(...)`; deleted `TARIFA_VISITA_BASE`; 21-arg canonical `reconstituir` + 19-arg delegating overload; dispute-without-agreement clears the detail too |
| `backend/.../ot/infrastructure/persistence/OtJpaEntity.java` | Modified | `@Column(name = "distancia_km") Double` and `@Column(name = "tarifa_fuente", length = 20) String`, both nullable, per the design's per-column mapping table |
| `backend/.../ot/application/usecases/EstimarTarifaUseCase.java` | Modified | Added `estimarPara(Point)` → `Optional<TarifaEstimada>` (non-throwing reuse of the slice-2 authority) |
| `backend/.../ot/application/usecases/FinalizarOtUseCase.java` | Modified | Computes + persists the authoritative tariff before saving |
| `backend/.../ot/application/usecases/CancelarOtUseCase.java` | Modified | Outside the free window computes + persists; inside it writes nothing |
| `backend/.../ot/application/usecases/RechazarPresupuestoUseCase.java` | Modified | Replaced the deleted constant with the authoritative computation (AD13 reader) |
| `backend/src/main/resources/schema.sql` | Modified | Added `distancia_km DOUBLE PRECISION` and `tarifa_fuente VARCHAR(20)` to the `ot` mirror |
| `backend/.../test/.../FinalizarOtUseCaseTest.java` | Modified | Constructor + 2 tests (authoritative value; config override changes price) |
| `backend/.../test/.../CancelarOtUseCaseTest.java` | Modified | Constructor + computed-value/distance/source assertions |
| `backend/.../test/.../RechazarPresupuestoUseCaseTest.java` | Modified | Constructor + computed-value/distance/source assertions |
| `backend/.../test/.../OtDiagnosticoPresupuestoIT.java` | Modified | OT location moved inside the service radius; asserts the persisted tariff/distance/source |
| `backend/.../test/.../TarifaPersistenciaIT.java` | Created | 4 DB round-trip tests: finalize, cancel outside window, cancel inside window, acceptance persists nothing |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*TarifaPersistenciaIT' --tests '*FinalizarOtUseCaseTest' --tests '*CancelarOtUseCaseTest' --tests '*RechazarPresupuestoUseCaseTest' --tests '*OtDiagnosticoPresupuestoIT'` → `BUILD SUCCESSFUL`; `TarifaPersistenciaIT` 4/0, `FinalizarOtUseCaseTest` 5/0, `CancelarOtUseCaseTest` 6/0, `RechazarPresupuestoUseCaseTest` 2/0, `OtDiagnosticoPresupuestoIT` 8/0 failures. |
| Runtime harness command/scenario and exact result | `cd backend && ./gradlew bootRun` (H2) + a real HTTP walk (create → accept offer → displacement → diagnosis → approve → finalize). Observed: create `BUSCANDO_TECNICO`; **accept `ASIGNADA` with `tarifaVisita=null`** (acceptance persists nothing); **finalize `FINALIZADA` with `tarifaVisita=30000`**. Offline read-back of the row: `TARIFA_VISITA=30000.00 | DISTANCIA_KM=1.584831252981315 | TARIFA_FUENTE=LINEAL`. |
| Migration safety (non-empty `ot`, `ddl-auto=update`) | Pre-seeded an `ot` table **without** the new columns + 1 legacy row, then booted with `--spring.jpa.hibernate.ddl-auto=update`: the entity mapping added `DISTANCIA_KM DOUBLE PRECISION (nullable YES)` and `TARIFA_FUENTE CHARACTER VARYING (nullable YES)`; the legacy row survived (`tarifa_visita=50000.00, distancia_km=null, tarifa_fuente=null`); a new finalized OT on the ALTERed table read back `FINALIZADA / 30000.00 / 1.584831252981315 / LINEAL`. |
| Rollback boundary | `Ot` (2 fields + `registrarTarifaVisita` + `reconstituir` overload), `OtJpaEntity` (2 columns), `EstimarTarifaUseCase.estimarPara`, the 3 write use cases, the `schema.sql` `ot` delta, and the 5 test files (4 modified + 1 created). No other module, no `application.properties`, no frontend, no `schema-postgres.sql` change. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*TarifaPersistenciaIT'` → **BUILD SUCCESSFUL**, 4 tests / 0 failures
3. Runtime harness `./gradlew bootRun` + finalize an OT → persisted `tarifa_visita=30000.00`, `distancia_km=1.584831252981315`, `tarifa_fuente=LINEAL` (read back from the database)
4. `cd backend && ./gradlew test` → **304 tests / 4 failures**, all 4 `ClientesApiIT` (the frozen out-of-scope baseline; 298 → 304 tests from the 6 new slice-3 tests). No new regressions.

## Budget

**Slice 3 authored: 410 changed lines** (376 insertions + 34 deletions as committed in `e9bb926`; the 184-line new `TarifaPersistenciaIT` included). Within the 615-line hard budget; no `size:exception` needed for this slice.

## Deviations from Design

- **`OtRepositoryAdapter` unchanged** (task 3.2 named it). The two columns map through `OtJpaEntity.applyFromDomain`/`toDomain`, exactly like every other column; the adapter only delegates to the entity, so an adapter edit would be dead code.
- **`RechazarPresupuestoUseCase` included** although task 3.3's file list named only finalize/cancel: it was the other reader of the deleted `TARIFA_VISITA_BASE`, and budget rejection is a cancellation where the tariff is written today, so AD13 + spec T6 require it to compute authoritatively too.
- **`tarifa_fuente` stored as `String`** in the entity exactly as the design's per-column mapping table specifies, parsed to `TarifaFuente` at the domain boundary.
- **Postgres `prod,postgres` boot not run**: the rootless-podman environment could not initialize the PostGIS container (`initdb`/socket permission errors). The `ddl-auto=update` ALTER path was instead exercised on H2 against a non-empty `ot` table; `schema-postgres.sql` needs no change (design: suppliers are not spatially queried).

## Out of Scope (do not absorb)

- Slices 4–14: auxiliares, proveedores, despacho-insumos, frontend surfaces, full boot/verify.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.

---

# Slice 4 — Auxiliar persistence (PR 4 of the chained/stacked delivery)

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 4.1 | Auxiliar persistence: `auxiliares_requeridos` column + `Ot` field with a 22-arg canonical `reconstituir` and the 21- and 19-arg delegating overloads (AD3); the count rides the `asignarSiDisponible` `SET` (AD2); `intentarAsignar` 5-arg canonical + 4-arg delegating overload across port and adapter; `schema.sql` `auxiliares_requeridos INT NOT NULL DEFAULT 0`. **No post-bulk write.** | `[x]` |
| 4.2 | Expose `auxiliaresRequeridos` in `OtResponse`/`OtApiResponse`, defaulting to 0 for legacy rows. | `[x]` |
| 4.4 (partial) | Frontend contract lockstep for the OT count only: `common.models.ts` + `backend.dto.ts` + `backend.mappers.ts`. No accept body, no validation, no mock, no UI (those are slices 5 and 12). | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../ot/domain/aggregates/Ot.java` | Modified | Added `int auxiliaresRequeridos` + getter; new 22-arg canonical `reconstituir` mapping a `null` count to `0`; the 21-arg and 19-arg forms delegate a zero default (AD3) |
| `backend/.../ot/infrastructure/persistence/OtJpaEntity.java` | Modified | `@Column(name = "auxiliares_requeridos", nullable = false, columnDefinition = "integer default 0") private int auxiliaresRequeridos`; mapped in `applyFromDomain`/`toDomain` |
| `backend/.../ot/infrastructure/persistence/SpringDataOtRepository.java` | Modified | `o.auxiliaresRequeridos = :auxiliaresRequeridos` added to the same atomic conditional `SET` (AD2); new `@Param` |
| `backend/.../ot/domain/repository/OtRepository.java` | Modified | 5-arg canonical `intentarAsignar`; 4-arg kept delegating 0 (AD3) |
| `backend/.../ot/infrastructure/repository/OtRepositoryAdapter.java` | Modified | 4-arg delegates to the 5-arg; the 5-arg passes the count into `asignarSiDisponible` |
| `backend/.../ot/application/dto/OtResponse.java` | Modified | Added `int auxiliaresRequeridos`, mapped from the aggregate |
| `backend/.../ot/infrastructure/api/responses/OtApiResponse.java` | Modified | Added `int auxiliaresRequeridos`, mapped from `OtResponse` |
| `backend/src/main/resources/schema.sql` | Modified | `auxiliares_requeridos INT NOT NULL DEFAULT 0` in the `ot` mirror |
| `frontend/.../domain/models/common.models.ts` | Modified | `auxiliaresRequeridos?: number` on the `OtResponse` view model |
| `frontend/.../infrastructure/api/backend.dto.ts` | Modified | `auxiliaresRequeridos: number` on `OtApiResponse` (always present on the wire) |
| `frontend/.../infrastructure/api/backend.mappers.ts` | Modified | `aOtResponse` maps `auxiliaresRequeridos` |
| `backend/.../test/.../ot/domain/aggregates/OtTest.java` | Modified | 3 tests: legacy form defaults 0; canonical keeps 3; canonical maps `null` to 0 |
| `backend/.../test/.../ot/infrastructure/persistence/OtRepositoryTest.java` | Modified | 2 tests: the 5-arg bulk update persists the count; the 4-arg overload persists 0 |
| `backend/.../test/.../ot/infrastructure/api/controllers/OtApiIT.java` | Modified | Creation response asserts `auxiliaresRequeridos = 0` |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*OtTest' --tests '*OtRepositoryTest'` → `BUILD SUCCESSFUL`; `OtTest` 21/0 failures, `OtRepositoryTest` 9/0 failures. Extra (task 4.2 verify command): `*OtApiIT` 6/0 failures. |
| Runtime harness command/scenario and exact result | `cd backend && ./gradlew bootRun` against a file-backed H2 (`--spring.datasource.url=jdbc:h2:file:/tmp/opencode/slice4/coldday;DB_CLOSE_DELAY=-1 --spring.jpa.hibernate.ddl-auto=update`) + real HTTP walk: login `cliente1@coldday.com.co` → `POST /api/ot` (AIRE_ACONDICIONADO near técnico1), login `tecnico1@coldday.com.co` → `GET /api/tecnicos/me/ofertas` → `POST /api/ofertas/{id}/aceptar` (no body). Accept response: `{"estado":"ASIGNADA","auxiliaresRequeridos":0}`. Offline `org.h2.tools.Shell` read-back of the row: `ESTADO=ASIGNADA | AUXILIARES_REQUERIDOS=0`; column DDL `AUXILIARES_REQUERIDOS INTEGER NOT NULL DEFAULT 0`. |
| Rollback boundary | The `auxiliares_requeridos` column (entity + `schema.sql` delta), the `Ot` field/getter + `reconstituir` overloads, the `intentarAsignar` overloads in port/adapter, the `SET` item in `SpringDataOtRepository`, the `OtResponse`/`OtApiResponse` fields, the 3 frontend contract additions, and the 3 test files. No `AceptarOfertaUseCase`, controller, request record, config, `mock-db` or UI change. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*OtTest' --tests '*OtRepositoryTest'` → **BUILD SUCCESSFUL**, 30 tests / 0 failures
3. `cd backend && ./gradlew test --tests '*OtApiIT'` → **BUILD SUCCESSFUL**, 6 tests / 0 failures
4. Runtime harness (above): accepted OT row `auxiliares_requeridos=0`; column `INTEGER NOT NULL DEFAULT 0`
5. `cd backend && ./gradlew test` → **309 tests / 4 failures**, all 4 `ClientesApiIT` (the frozen out-of-scope baseline; 304 → 309 from the 5 new slice-4 tests). No new regressions.
6. `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 0 (contract files type-check; no frontend build/test run in this slice)

## Budget

**Slice 4 authored: 146 changed lines** (136 insertions + 10 deletions) — within the 750-line attempt budget, and well within the per-slice review budget; no `size:exception` needed.

## Deviations from Design

- **`intentarAsignar` 4-arg is a concrete delegating method**, not a Java `default` interface method: the adapter implements both signatures and the 4-arg calls the 5-arg with `0`. This matches AD3 verbatim ("keep the 4-arg overload delegating `0`") and leaves every existing Mockito stub/verify on the 4-arg working.
- **Frontend view-model field is optional** (`auxiliaresRequeridos?: number`) while the wire DTO field is required (`auxiliaresRequeridos: number`). A required view-model field would have forced edits to the `OtResponse` literals in `mock-db.service.ts`, which `tasks.md` assigns to slice 5 (task 4.4) and which the orchestrator scoped out. The mapper always populates the field from the always-present wire value, so runtime consumers see it; slice 5 can tighten it to required when it touches the mock.
- **`schema-postgres.sql` unchanged** — no new spatial/PostGIS artifact is introduced; `application-postgres.properties` points `schema-locations` at it and `ddl-auto=update` derives the `ot` ALTER from the entity mapping (design schema section). Stated explicitly per the task.

## Out of Scope (do not absorb)

- Slice 5: optional accept request body, `@Min(0)` + `app.auxiliares.max` validation, `AceptarOfertaUseCase`/controller wiring, `AceptarOfertaApiRequest`, `mock-db` accepting the count, `AuxiliaresApiIT`.
- Slices 6–14: proveedores, despacho-insumos, frontend surfaces, UI, full boot/verify.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.

---

# Slice 5 — Auxiliar accept API (PR 5 of the chained/stacked delivery)

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 4.3 | Optional accept body + `@Min(0)` validation + configurable maximum (`app.auxiliares.max`, default 10) enforced in `AceptarOfertaUseCase`; 400 before any write. | `[x]` |
| 4.4 | Frontend lockstep: the view-model field is now required and every mock `OtResponse` literal carries it; `aceptarOferta` sends the optional body and the mock accepts the count. No UI work (slice 12). | `[x]` |
| 4.5 | Tests at this slice's layer: no body → 0; count 2 exposed; negative/over-max → 400; non-integer → 400; loser records nothing. | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../ot/domain/exception/ConteoAuxiliaresInvalidoException.java` | Created | Domain error for a count outside `[0, app.auxiliares.max]`; raised before any write (AD4) |
| `backend/.../ot/infrastructure/api/requests/AceptarOfertaApiRequest.java` | Created | `{auxiliaresRequeridos?: Integer}` with `@Min(0)`; the maximum stays config-driven, so no `@Max` |
| `backend/.../ot/application/usecases/AceptarOfertaUseCase.java` | Modified | 3-arg canonical `aceptar` + 2-arg delegating overload; `@Value("${app.auxiliares.max:10}")` injected and validated before any write; the count threads into the slice-4 canonical `intentarAsignar(..., auxiliaresRequeridos)` — the single conditional UPDATE only (AD2) |
| `backend/.../ot/infrastructure/api/controllers/OfertaOtController.java` | Modified | `@Valid @RequestBody(required = false) AceptarOfertaApiRequest`; absent body or absent field → 0 |
| `backend/.../ot/infrastructure/api/controllers/OfertaOtControllerAdvice.java` | Modified | `ConteoAuxiliaresInvalidoException` → 400 canonical `ApiError`; `HttpMessageNotReadableException` → 400 for an ill-typed count |
| `backend/src/main/resources/application.properties` | Modified | `app.auxiliares.max=${AUXILIARES_MAX:10}`, env-overridable (existing convention) |
| `backend/.../test/.../ot/application/usecases/AceptarOfertaUseCaseTest.java` | Modified | Constructor + 6 new tests; every stub/verify moved to the canonical 5-arg `intentarAsignar` |
| `backend/.../test/.../ot/application/usecases/AceptacionConcurrenteIT.java` | Modified | Both threads now pass a count (2 / 3) and the winner's count is asserted on the OT (aux.S3.1) |
| `backend/.../test/.../ot/infrastructure/api/controllers/AuxiliaresApiIT.java` | Created | 6 end-to-end tests over the optional body, with `app.auxiliares.max=5` proving the maximum is config-driven |
| `frontend/.../domain/models/common.models.ts` | Modified | `auxiliaresRequeridos` made **required** now that every literal populates it |
| `frontend/.../infrastructure/mock/mock-db.service.ts` | Modified | All 6 seeded `OtResponse` literals plus the `crearOt`/`aceptarOt` builders carry the count; `aceptarOferta` takes an optional count (default 0) and records it |
| `frontend/.../modules/tecnicos/infrastructure/tecnicos-api.ts` | Modified | `aceptarOferta(ofertaId, tecnicoId, auxiliaresRequeridos?)` posts `{auxiliaresRequeridos: n ?? 0}` and forwards the count to the mock |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*AceptarOfertaUseCaseTest' --tests '*AuxiliaresApiIT'` → `BUILD SUCCESSFUL`; `AceptarOfertaUseCaseTest` 13/0 failures, `AuxiliaresApiIT` 6/0 failures. |
| Runtime harness command/scenario and exact result | `cd backend && ./gradlew bootRun` (file-backed H2, `ddl-auto=update`) + a real HTTP walk. **Without a body**: `HTTP 200`, `estado=ASIGNADA`, `auxiliaresRequeridos=0`. **With `{"auxiliaresRequeridos":2}`**: `HTTP 200`, `estado=ASIGNADA`, `auxiliaresRequeridos=2`. **Negative `-1`**: `HTTP 400` `{"status":400,"message":"Solicitud invalida","fieldErrors":["auxiliaresRequeridos no puede ser negativo"]}`. **Non-integer `"dos"`**: `HTTP 400` `fieldErrors:["cuerpo de la solicitud ilegible"]`. **Over-max `99`** (default max 10): `HTTP 400` `fieldErrors:["auxiliaresRequeridos debe estar entre 0 y 10"]`. After every rejected attempt the offer was still `PENDIENTE` and the OT still `BUSCANDO_TECNICO`. Offline read-back: `AUXILIARES_REQUERIDOS = 0` and `2` for the two accepted OTs, `0` with `BUSCANDO_TECNICO` for the one whose invalid accepts were rejected. |
| Regression guard | `cd backend && ./gradlew test --tests '*OtApiIT' --tests '*OfertaApiIT' --tests '*AceptacionConcurrenteIT'` → `BUILD SUCCESSFUL`; `OtApiIT` 6/0, `OfertaApiIT` 7/0, `AceptacionConcurrenteIT` 1/0. The bodyless accept path in `OfertaApiIT` is untouched. |
| Rollback boundary | `ConteoAuxiliaresInvalidoException`, `AceptarOfertaApiRequest`, the `AceptarOfertaUseCase` overload/validation/threading, the controller body param, the two advice handlers, the `app.auxiliares.max` key, the frontend required field + mock literals + `aceptarOferta` body, and the 3 test files. No `Ot` aggregate, `schema.sql`, persistence, `intentarAsignar` signature or `@Version` path is touched. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*AceptarOfertaUseCaseTest' --tests '*AuxiliaresApiIT'` → **BUILD SUCCESSFUL**, 19 tests / 0 failures
3. `cd backend && ./gradlew test --tests '*OtApiIT'` (+ `*OfertaApiIT`, `*AceptacionConcurrenteIT`) → **BUILD SUCCESSFUL**, 14 tests / 0 failures
4. `cd backend && ./gradlew test` → **321 tests / 4 failures**, all 4 `ClientesApiIT` (the frozen out-of-scope baseline; 309 → 321 from the 12 new slice-5 tests). No new regressions.
5. `cd frontend && npm run build` → **BUILD SUCCESSFUL**; `npx tsc -p tsconfig.app.json --noEmit` → exit 0
6. `cd frontend && npm run test` → **1 failed / 1 total**. Proven pre-existing: stashing this slice's three frontend files and re-running reproduced the identical `TypeError: Cannot read properties of undefined (reading 'getItem')` at `app.spec.ts:486` (`LayoutService.restore`), unrelated to auxiliares and untouched here.

## Budget

**Slice 5 authored: 489 changed lines** (231 tracked insertions + deletions across 8 files, plus 258 lines across 3 new files: 14 + 17 + 227). Within the 615-line hard budget; no `size:exception` needed.

## Deviations from Design

- **`ConteoAuxiliaresInvalidoException` added** (not named in `tasks.md` 4.3). The design (AD4) requires the maximum to be enforced in the use case, and the domain layer must not depend on Spring HTTP types; a domain exception mapped to 400 by the existing `OfertaOtControllerAdvice` is the canonical pattern already used by `MotivoRequeridoException`. Without it the 400 could not carry the canonical shape.
- **`HttpMessageNotReadableException` → 400 added to the advice.** An ill-typed count (`"dos"`) cannot bind at all, so `@Valid` never runs; without this handler the spec's "ill-typed count → 400" (aux.S2.2) would have surfaced as a 500.
- **`OfertaOtControllerAdvice` extended rather than a new advice created**, keeping the canonical `ApiError` 400 shape and one error surface for the accept endpoint.
- **`mock-db` seeded literals got distinct counts** (1/2/3) instead of all zero, so the mock exercises the exposed field rather than only the legacy default; `crearOt`/`aceptarOt` write `0`.
- **No UI change.** `ofertas-page.ts` still calls `aceptarOferta(oferta.id, tecnico.id)`; the new parameter is optional and defaults to 0, exactly as design intends (slice 12 owns the UI).

## Out of Scope (do not absorb)

- Slices 6–14: proveedores, despacho-insumos, frontend surfaces, UI, full boot/verify.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- The pre-existing frontend `app.spec.ts` failure — pre-existing, reproduced without this slice.

---

# Slice 6 — Proveedor identity (PR 6 of the chained/stacked delivery)

Identity foundation only (task 5.1). The admin provisioning + listing API (task 5.2) is slice 7; the despacho-insumos context is slices 8–11; UI/routes are slice 12.

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 5.1 | New `proveedores` bounded context: `Proveedor` aggregate + `ProveedorId` VO + `ProveedorRepository` port; `ProveedorJpaEntity` + `SpringDataProveedorRepository` + `ProveedorRepositoryAdapter`; `Rol.PROVEEDOR`; additive `proveedor` table in `schema.sql`; 1 idempotent seeded supplier. **No public surface, no registration endpoint.** | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../proveedores/domain/valueobjects/ProveedorId.java` | Created | Own-UUID identity record, mirroring `TecnicoId` |
| `backend/.../proveedores/domain/aggregates/Proveedor.java` | Created | Supplier identity aggregate: business identity + `Point` location + `categoriasInsumo` metadata + `activo`; `crear` enforces the linked-`Usuario` invariant (P1); `desactivar`/`activar` (P5); `reconstituir` for persistence |
| `backend/.../proveedores/domain/repository/ProveedorRepository.java` | Created | Port: `save`, `buscarPorId`, `findByUsuarioId`, `findByActivoTrue` (P5/AD7 eligibility), `deleteAll` |
| `backend/.../proveedores/infrastructure/persistence/CategoriasInsumoJsonConverter.java` | Created | `Set<String>` ↔ `categorias_insumo` JSON column, mirroring `CategoriaServicioJsonConverter` |
| `backend/.../proveedores/infrastructure/persistence/ProveedorJpaEntity.java` | Created | `proveedor` mapping: own UUID PK, scalar unique `usuario_id`, unique `nit`, nullable contact/location, `activo` defaulted, `creado_en` |
| `backend/.../proveedores/infrastructure/repository/SpringDataProveedorRepository.java` | Created | `JpaRepository` with `findByActivoTrue` + `findByUsuarioId` |
| `backend/.../proveedores/infrastructure/repository/ProveedorRepositoryAdapter.java` | Created | Adapter delegating to the entity mapper (insert/merge semantics) |
| `backend/.../usuarios/domain/valueobjects/Rol.java` | Modified | Added `PROVEEDOR` (D7 role) |
| `backend/src/main/resources/schema.sql` | Modified | Additive `CREATE TABLE IF NOT EXISTS proveedor` mirroring the entity (design DDL) |
| `backend/.../shared/infrastructure/seed/DevDataSeeder.java` | Modified | Injects `ProveedorRepository`; seeds 1 idempotent Proveedor (`proveedor1@coldday.com.co`), same `app.seed.enabled` flag |
| `frontend/.../core/shared/domain/models/common.models.ts` | Modified | `Rol` union gains `'PROVEEDOR'` (enum value only; no routes/guards/pages) |
| `backend/.../test/.../proveedores/domain/aggregates/ProveedorTest.java` | Created | 7 domain tests: creation, linked-`Usuario` invariant, required fields, active toggle, null categories, reconstitution |
| `backend/.../test/.../proveedores/infrastructure/persistence/ProveedorRepositoryTest.java` | Created | 4 `@DataJpaTest` tests: save/find, location+categories round-trip, active lookup excludes inactive (P5), duplicate NIT rejected |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*ProveedorTest'` → `BUILD SUCCESSFUL`; `ProveedorTest` `tests="7" failures="0"`. Extra: `--tests '*ProveedorRepositoryTest'` → `BUILD SUCCESSFUL`, `tests="4" failures="0"`. |
| Runtime harness command/scenario and exact result | `cd backend && ./gradlew bootRun` (file-backed H2, `ddl-auto=update`). Seed log: `Seed verificado: 5 clientes, 5 técnicos y 1 proveedores creados`. `POST /api/usuarios/login` with `{"correo":"proveedor1@coldday.com.co","password":"demo1234"}` → **HTTP 200**, body `{"token":"...","expiracion":"...","rol":"PROVEEDOR"}`; the JWT payload decodes to `{"sub":"11","rol":"PROVEEDOR","ver":0,...}`. Offline `org.h2.tools.Shell` read-back of `proveedor JOIN usuario` → `Suministros del Norte S.A.S. | 900123456-1 | TRUE | 11 | proveedor1@coldday.com.co | PROVEEDOR`. |
| `Rol`-generic JWT confirmation (design verified, no edit) | `JwtTokenIssuer`, `JwtAuthenticationFilter` and `SecurityConfig` were **not modified**. The runtime harness proves it: login issued `rol=PROVEEDOR` and `Rol.valueOf("PROVEEDOR")` resolved in the filter. No `permitAll` matcher was added (D7). |
| Regression guard | `cd backend && ./gradlew test` → **332 tests / 4 failures**, and the 4 failing classes are exactly `ClientesApiIT` (the frozen out-of-scope baseline; 321 → 332 from the 11 new slice-6 tests). No new regressions. |
| Frontend contract guard | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 0 (the new union member breaks no exhaustive switch/record; no UI added). |
| Rollback boundary | `modules/proveedores/**` (7 main + 2 test files), the `Rol.PROVEEDOR` member, the `proveedor` table block in `schema.sql`, the `DevDataSeeder` proveedor wiring, and the `'PROVEEDOR'` union member in `common.models.ts`. No `ot`/tariff/auxiliar behavior, no `SecurityConfig`/JWT, no `schema-postgres.sql`, no controller/route/guard is touched. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*ProveedorTest'` → **BUILD SUCCESSFUL**, 7 tests / 0 failures
3. `cd backend && ./gradlew test --tests '*ProveedorRepositoryTest'` → **BUILD SUCCESSFUL**, 4 tests / 0 failures
4. Runtime harness (above): seeded supplier resolves via login (`rol=PROVEEDOR`) and the persisted row joins its `usuario`
5. `cd backend && ./gradlew test` → **332 tests / 4 failures**, all 4 `ClientesApiIT`
6. `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 0

## Budget

Authored changed lines for this slice (measured with `git diff --cached --numstat`):

- Implementation + tests (13 files: 4 modified + 9 new): **659** (654 additions + 5 deletions) — within the 720-line hard budget.
- Merged apply-progress artifact: **77** (76 additions + 1 deletion).
- **Combined work unit: 736** — 16 lines over the 720 hard cap once the artifact is included.

The 659 implementation lines are one cohesive work unit (aggregate + VO + port + JPA + adapter + schema + seed + tests); the review-budget rule forbids shrinking it by deleting tests, comments or docs, and one honest slicing pass found no cohesive split (splitting the aggregate from its persistence/tests would break work-unit cohesion). **Recommend `size:exception` for the 16-line artifact overage**; the implementation itself needs no exception.

## Deviations from Design

- **`categorias_insumo` modelled as `Set<String>`** with a local `CategoriasInsumoJsonConverter`. The design names no `CategoriaInsumo` VO for this context and calls the field descriptive metadata (AD7); reusing the `tecnicos`-owned `CategoriaServicio` enum would invert the bounded-context direction. The JSON-in-a-single-column shape mirrors `CategoriaServicioJsonConverter` exactly.
- **`usuario_id` uniqueness enforced by the column constraint** (`@Column(unique = true)`), not by a separately named `@Index` as the design's index list sketched. This matches `TecnicoJpaEntity`/`ClienteJpaEntity`; both H2 and Postgres create a unique index for it.
- **No `NitDuplicadoException`** added. The design specifies 409 only for a duplicate `correo` (handled by the slice-7 use case via `existeCorreo`); a duplicate `nit` is unspecified, so the adapter lets the unique-constraint violation surface rather than inventing an exception.
- **`schema-postgres.sql` unchanged** — no new spatial/PostGIS artifact is introduced; suppliers are not spatially queried (design schema section). Stated explicitly per the task.
- **No `findAll` on the port yet**: listing (including inactive) is slice 7 (task 5.2); adding it now would be speculative.

## Out of Scope (do not absorb)

- Slice 7: `RegistrarProveedorUseCase`, `ListarProveedoresUseCase`, DTOs/controller/advice, `ProveedorApiIT`, admin frontend surface.
- Slices 8–14: despacho-insumos, frontend surfaces, UI, full boot/verify.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- The pre-existing frontend `app.spec.ts` failure — pre-existing, untouched by this slice.
