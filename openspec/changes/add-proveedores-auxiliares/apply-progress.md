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

---

# Slice 7 — Supplier admin API (PR 7 of the chained/stacked delivery)

Admin provisioning + listing API (task 5.2), admin frontend surface (task 5.3) and their tests (task 5.4). The despacho-insumos context is slices 8–11; routes/menu/auth and the supplier portal are slice 12.

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 5.2 | `RegistrarProveedorUseCase` (Usuario first with `Rol.PROVEEDOR`, then `Proveedor`, one `@Transactional`) + `ListarProveedoresUseCase` (incl. inactive); request/response DTOs, `ProveedorController` (`POST`/`GET /api/proveedores`, `@PreAuthorize('ADMINISTRADOR')`), `ProveedorControllerAdvice`; 201/400/403/409/401. | `[x]` |
| 5.3 | Frontend lockstep: proveedor DTO/mapper/mock + `AdminApi.getProveedores`/`crearProveedor` + `ProveedoresAdminPage`. No routes/menu/auth (slice 12). | `[x]` |
| 5.4 | Tests: provision 201/active/no-credentials; invalid 400; duplicate correo 409; duplicate nit 409 + rollback; non-admin 403 (create + list); unauthenticated 401; list incl. inactive; JWT carries `PROVEEDOR`; supplier blocked from unrelated operations. | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../proveedores/application/dto/ProveedorRequest.java` | Created | Application command: account credentials + business identity, mirroring `TecnicoRequest` |
| `backend/.../proveedores/application/dto/ProveedorResponse.java` | Created | Flat proveedor view (business identity + `usuarioId`, no credentials) |
| `backend/.../proveedores/application/usecases/RegistrarProveedorUseCase.java` | Created | `@Transactional`: duplicate-correo pre-check → `Usuario.registrar(..., Rol.PROVEEDOR, ...)` → linked `Proveedor`; no half-created account |
| `backend/.../proveedores/application/usecases/ListarProveedoresUseCase.java` | Created | Lists every supplier including inactive (P4) |
| `backend/.../proveedores/domain/repository/ProveedorRepository.java` | Modified | Added `List<Proveedor> findAll()` |
| `backend/.../proveedores/infrastructure/repository/ProveedorRepositoryAdapter.java` | Modified | Implemented `findAll` |
| `backend/.../proveedores/infrastructure/api/requests/ProveedorApiRequest.java` | Created | Wire request with Bean Validation (`@NotBlank`/`@Email`/`@NotNull`) → 400 |
| `backend/.../proveedores/infrastructure/api/responses/ProveedorApiResponse.java` | Created | Scalar-`id` API view, no credentials, mirrors `TecnicoApiResponse` |
| `backend/.../proveedores/infrastructure/api/controllers/ProveedorController.java` | Created | `POST`/`GET /api/proveedores` with `@PreAuthorize('ADMINISTRADOR')` |
| `backend/.../proveedores/infrastructure/api/controllers/ProveedorControllerAdvice.java` | Created | Canonical `ApiError`: validation 400, correo 409, Habeas Data 400, integrity 409 |
| `frontend/.../domain/models/common.models.ts` | Modified | `ProveedorRequest` + `ProveedorResponse` view models |
| `frontend/.../infrastructure/api/backend.dto.ts` | Modified | `ProveedorApiRequest` + `ProveedorApiResponse` wire DTOs |
| `frontend/.../infrastructure/api/backend.mappers.ts` | Modified | `aProveedorResponse` mapper |
| `frontend/.../infrastructure/mock/mock-db.service.ts` | Modified | `proveedores` signal (one active, one inactive) + `crearProveedor` |
| `frontend/.../administracion/infrastructure/admin-api.ts` | Modified | `getProveedores` + `crearProveedor` with mock branch |
| `frontend/.../administracion/presentation/proveedores-admin-page.ts` | Created | Standalone admin page: provisioning form + listing incl. inactive |
| `backend/.../test/.../proveedores/.../ProveedorApiIT.java` | Created | 9 end-to-end tests (prov.S1.1–S5.1) |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*ProveedorApiIT'` → `BUILD SUCCESSFUL`; `ProveedorApiIT` `tests="9" failures="0" errors="0"`. |
| Runtime harness command/scenario and exact result | `cd backend && ./gradlew bootRun` (H2) + real HTTP walk. Login `admin@coldday.com.co` → `POST /api/proveedores` **201** (body exposes `usuarioId`, `razonSocial`, `nit`, `activo=true`, **no `password`**); same `correo` → **409** `{"status":409,"message":"Correo duplicado: ..."}`; duplicate `nit` (different correo) → **409** `{"message":"NIT duplicado o dato unico ya registrado"}`; `GET /api/proveedores` as admin → **200** (seeded + created); `GET`/`POST` as `TECNICO` → **403**; `GET`/`POST` unauthenticated → **401**; login of the created supplier → **200** `{"rol":"PROVEEDOR"}` (JWT payload `{"sub":"14","rol":"PROVEEDOR","ver":0}`). |
| Regression guard | `cd backend && ./gradlew test` → **341 tests / 4 failures**, all 4 `ClientesApiIT` (the frozen out-of-scope baseline; 332 → 341 from the 9 new slice-7 tests). No new regressions. |
| Frontend guard | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npm run build` → **BUILD SUCCESSFUL**. |
| Rollback boundary | The `proveedores` application/api files (4 new use cases/DTOs + 4 API files), the `findAll` port+adapter additions, the 5 frontend contract files + `admin-api` + `proveedores-admin-page`, and `ProveedorApiIT`. No `SecurityConfig`/JWT, no schema, no `ot`/tariff/auxiliar behavior, no routes/menu. |

## Design-gap decision — duplicate `nit`

The design specifies **409 only for duplicate `correo`** and is silent on `nit`. Decision: **a duplicate `nit` maps to 409, consistently with `correo`, and never a 500.** It is not pre-checked (matching slice 6's stance: the adapter lets the `UNIQUE(nit)` violation surface); the module's `ProveedorControllerAdvice` maps `DataIntegrityViolationException` to a canonical 409. Because `RegistrarProveedorUseCase` is `@Transactional`, the violation rolls the whole unit back — the runtime harness and `rejectsDuplicateNitWith409AndRollsBackTheAccount` prove the second account is not created. A pre-check would have been a second source of truth racing the DB constraint, so the constraint remains the single authority.

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*ProveedorApiIT'` → **BUILD SUCCESSFUL**, 9 tests / 0 failures
3. Runtime harness (above): 201 / 409 correo / 409 nit / 200 list / 403 non-admin / 401 unauthenticated / login `rol=PROVEEDOR`
4. `cd backend && ./gradlew test` → **341 tests / 4 failures**, all 4 `ClientesApiIT`
5. `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npm run build` → **BUILD SUCCESSFUL**

## Budget

**Slice 7 authored: 766 changed lines** (137 tracked insertions across 7 modified files + 629 lines across 10 new files), plus the merged apply-progress section. This is **over the 690-line hard budget** for this attempt. The 766 lines are one cohesive work unit (provisioning/listing use cases + DTOs + controller + advice + repository `findAll` + full frontend lockstep + 9 ITs); one honest review found no cohesive split that does not separate the API from its frontend contract (constraint 10 forbids trailing the contract) or split the tests from the behavior they verify. Trimming would mean deleting tests/coverage, which the review-budget rule forbids. **Recommend `size:exception` for PR 7** (consistent with the accepted exceptions on slices 2 and 6). No `size:exception` was pre-recorded for this slice.

## Deviations from Design

- **Duplicate `nit` handled by the DB constraint → 409** rather than a new `NitDuplicadoException` pre-check (see the decision above). Explicit and test-covered.
- **`ProveedorResponse` is proveedor-centric** (`id`, `usuarioId`, `razonSocial`, `nit`, `telefono`, `activo`, `creadoEn`), not a Usuario+Proveedor join. The design says the response "exposes the supplier and its `usuarioId` but no credentials"; the admin listing therefore avoids an N+1 Usuario lookup while still returning inactive suppliers (P4). The provisioning form supplies `nombre`/`correo`, which the response intentionally does not echo.
- **`SeguridadIT` / `JwtTokenIssuerTest` not modified** (task 5.4 named them). Neither enumerates `Rol` values, so neither needed a `PROVEEDOR` case; the role boundary (JWT carries `PROVEEDOR`; supplier blocked from admin/tecnico surfaces) is covered end-to-end in `ProveedorApiIT`.
- **Routes/menu/auth untouched** — the page compiles but is not routed until slice 12 (task 6.6), per the stacked-slice plan.
- **`schema-postgres.sql` unchanged** — no new spatial artifact.

## Out of Scope (do not absorb)

- Slices 8–14: despacho-insumos, supplier portal/técnico/cliente pages, routes/menu/auth, full boot/verify.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- The pre-existing frontend `app.spec.ts` failure — pre-existing, untouched by this slice.

---

# Slice 8 — Despacho domain (PR 8 of the chained/stacked delivery)

Pure domain of the new `proveedores` insumo-dispatch context (task 6.1). Persistence (6.2) is slice 9, use cases + notification adapter + sweeper (6.3) slice 10, API + diagnóstico wiring (6.4–6.5) slice 11, frontend (6.6) slice 12.

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 6.1 | Domain: `EstadoRequerimiento` (no `CANCELADO`), `OfertaInsumoEstado` (`RECHAZADO`), `RequerimientoInsumo`, `OfertaInsumo`, `InsumoLinea`, `RequerimientoInsumoItem`, `RequerimientoInsumoId`, `OfertaInsumoId`, the `TransicionesRequerimiento` table and the context-owned `NotificacionInsumoPort` (AD14). | `[x]` |

## State machine as implemented (slice 9 binds to these exact names)

`EstadoRequerimiento` = `SOLICITADO, ASIGNADO, ENTREGADO, SIN_PROVEEDOR`. **No `CANCELADO`** — unreachable in the specs, deliberately omitted. Transitions: `SOLICITADO → ASIGNADO` (atomic accept gate, PROVEEDOR), `ASIGNADO → ENTREGADO` (delivery confirmed, PROVEEDOR), `SOLICITADO → SIN_PROVEEDOR` (zero eligible, SISTEMA). `ENTREGADO` is the only hard terminal; `SIN_PROVEEDOR` is terminal-but-retriable.

`OfertaInsumoEstado` = `PENDIENTE, ACEPTADA, RECHAZADO, EXPIRADA, CANCELADA`. Transitions from `PENDIENTE`: `→ ACEPTADA` (first conditional accept, PROVEEDOR), `→ RECHAZADO` (explicit decline, PROVEEDOR), `→ EXPIRADA` (sweeper / late accept, SISTEMA), `→ CANCELADA` (sibling won, SISTEMA). `RECHAZADO` is the literal (never `RECHAZADA`). `PENDIENTE` is the only actionable state; `ACEPTADA` is not a per-offer terminal because the request continues to `ENTREGADO`.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../proveedores/domain/valueobjects/EstadoRequerimiento.java` | Created | Root states `SOLICITADO/ASIGNADO/ENTREGADO/SIN_PROVEEDOR`; `esTerminal()` = `ENTREGADO` only; `CANCELADO` documented as removed |
| `backend/.../proveedores/domain/valueobjects/OfertaInsumoEstado.java` | Created | Offer states `PENDIENTE/ACEPTADA/RECHAZADO/EXPIRADA/CANCELADA`; `estaPendiente()`/`esTerminal()` |
| `backend/.../proveedores/domain/valueobjects/InsumoLinea.java` | Created | Free-text line VO: non-blank `descripcion` + positive `cantidad`; no catalog, no `Insumo` entity |
| `backend/.../proveedores/domain/valueobjects/RequerimientoInsumoId.java` | Created | Own-UUID identity record, mirroring `ProveedorId`/`OfertaOtId` |
| `backend/.../proveedores/domain/valueobjects/OfertaInsumoId.java` | Created | Own-UUID identity record with `of(String)` for path binding |
| `backend/.../proveedores/domain/entities/RequerimientoInsumoItem.java` | Created | Immutable line item (id + descripcion + cantidad) with `crear`/`reconstituir` |
| `backend/.../proveedores/domain/entities/OfertaInsumo.java` | Created | Offer mirroring `OfertaOt`: pending window, `estaVigente`, `aceptar`/`rechazar`/`expirar`/`cancelar` (all only from `PENDIENTE`) |
| `backend/.../proveedores/domain/aggregates/RequerimientoInsumo.java` | Created | Separate root; local `UUID otId`/`tecnicoId`; `crear` (≥1 line), `asignar`/`marcarEntregado`/`marcarSinProveedor`, `estaVigente`, `reconstituir` |
| `backend/.../proveedores/domain/exception/TransicionRequerimientoInvalidaException.java` | Created | Typed invalid-transition error mirroring `TransicionOtInvalidaException` |
| `backend/.../proveedores/domain/services/TransicionesRequerimiento.java` | Created | Explicit root transition table + trigger/actor javadoc (the `TransicionesOt` pattern) |
| `backend/.../proveedores/domain/services/NotificacionInsumoPort.java` | Created | Context-owned best-effort port (AD14), `notificarSolicitud`; never throws |
| `backend/.../test/.../proveedores/domain/aggregates/RequerimientoInsumoTest.java` | Created | 12 domain tests: creation, ≥1 line, mandatory data, line validation, all legal transitions, forbidden transitions, `CANCELADO` absent, expiry boundary, reconstitution |
| `backend/.../test/.../proveedores/domain/entities/OfertaInsumoTest.java` | Created | 11 domain tests: creation, mandatory data, expiry boundary, the four `PENDIENTE` resolutions, resolution-of-non-pending throws, `RECHAZADO` literal, terminal semantics, reconstitution |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*RequerimientoInsumoTest'` → `BUILD SUCCESSFUL`; `RequerimientoInsumoTest` `tests="12" failures="0" errors="0"`. Extra: `--tests '*OfertaInsumoTest'` → `BUILD SUCCESSFUL`, `tests="11" failures="0" errors="0"`. |
| Runtime harness command/scenario and exact result | **N/A** — this slice is pure domain with no Spring context, no DB and no network boundary. It declares no controller, repository, JPA mapping or scheduled bean, so there is no runtime path to exercise; the correctness surface is the transition table and aggregate invariants, proven by the unit tests above. |
| Bounded-context direction check | `proveedores/domain/**` imports only `java.*`, `proveedores.*` and `shared.domain.Point` (not used here). No `ot`/`tecnicos` import: `otId`/`tecnicoId` are local `UUID` references, so the `ot` domain never has to import `proveedores`. |
| Rollback boundary | The 11 new `proveedores/domain/**` files and the 2 new domain test files. No persistence, schema, use case, controller, adapter, frontend or `ot`/`tecnicos` behavior is touched. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*RequerimientoInsumoTest'` → **BUILD SUCCESSFUL**, 12 tests / 0 failures
3. `cd backend && ./gradlew test` → **364 tests / 4 failures**, all 4 `ClientesApiIT` (the frozen out-of-scope baseline; 341 → 364 from the 23 new slice-8 tests). No new regressions.

## Budget

Authored changed lines for this slice:

- Implementation + tests (13 files, all new): **1,001** (590 main + 411 test).
- Merged apply-progress artifact: this section.

**Over the 900-line hard budget** (≈430 estimate × 1.8 + artifact headroom). One honest slicing pass found no cohesive split: the state enums, ids, line item, aggregate, offer and transition table are a single state machine, and the tests must travel with it (work-unit-commits); splitting the aggregate from its state machine or its tests would break work-unit cohesion, which `tasks.md` already flags for slice 8. Trimming would mean deleting tests/comments, which the review-budget rule forbids. **Recommend `size:exception` for PR 8**, consistent with the accepted exceptions on slices 2, 6 and 7 and the tasks.md forecast that slice 8 carries one.

## Deviations from Design

- **`TransicionesRequerimiento` service added** (not in the task 6.1 file list). The design's transition table needs one explicit, testable source of truth; this mirrors `TransicionesOt` verbatim (design AD6) and makes "a transition the table forbids must throw" a first-class contract. The typed `TransicionRequerimientoInvalidaException` mirrors `TransicionOtInvalidaException`.
- **`otId`/`tecnicoId` are plain `UUID`**, not local id VOs. The task 6.1 list names only `RequerimientoInsumoId`/`OfertaInsumoId`; modelling the two foreign references as raw `UUID` keeps the bounded context free of `ot`/`tecnicos` types without inventing two more VOs.
- **No actor/trigger enum types.** Actor and trigger are made explicit in the `TransicionesRequerimiento` javadoc table and in each transition method's javadoc/name (`asignar`/`marcarEntregado` = PROVEEDOR, `marcarSinProveedor` = SISTEMA, `expirar`/`cancelar` = SISTEMA), matching how `TransicionesOt` documents the SRS. No history/actor column exists in the design schema, so a runtime actor type would be dead code.
- **`OfertaInsumo` has no `radioKm`** (unlike `OfertaOt`): insumo dispatch has no radius; eligibility is "all active suppliers" (AD7).
- **No persistence/schema file touched** — task 6.1 is domain-only; slice 9 owns the tables, JPA and adapters.

## Out of Scope (do not absorb)

- Slice 9: `requerimiento_insumo` / `requerimiento_insumo_item` / `oferta_insumo` tables, JPA entities, repository ports/adapters, `ProgramadorExpiracionInsumo`.
- Slices 10–12: use cases, notification adapter, API, diagnóstico wiring, frontend.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- The pre-existing frontend `app.spec.ts` failure — pre-existing, untouched by this slice.

---

# Slice 9 — Despacho persistence (PR 9 of the chained/stacked delivery)

Persistence of the slice-8 dispatch domain (task 6.2) plus the expiry sweeper. Use cases (slice 10), API/diagnóstico wiring (slice 11) and frontend (slice 12) are out of scope.

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 6.2 | The three dispatch tables (`requerimiento_insumo`, `requerimiento_insumo_item`, `oferta_insumo`) + indexes, no `precio_total`; JPA entities, repository ports and adapters; the atomic two-level first-accept gate (`asignarSiDisponible` + `aceptarSiVigente`) as conditional bulk UPDATEs | `[x]` |
| 6.3 (sweeper only) | `ProgramadorExpiracionInsumo` (`@Scheduled`, `app.insumos.barrido-ms`) + `app.insumos.vigencia-ms`; the use cases stay slice 10 | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../proveedores/domain/repository/RequerimientoInsumoRepository.java` | Created | Port: save/find, `buscarPorOt`/`buscarPorTecnico`, `intentarAsignar` gate, `expirarVencidos` |
| `backend/.../proveedores/domain/repository/OfertaInsumoRepository.java` | Created | Port: save/find, pending listing, `intentarAceptar`, `invalidarPendientesDe`, `expirarVencidas` |
| `backend/.../proveedores/infrastructure/persistence/RequerimientoInsumoJpaEntity.java` | Created | `requerimiento_insumo` mapping; scalar `ot_id`/`tecnico_id`; EAGER cascaded `@OneToMany` items; `@Version` |
| `backend/.../proveedores/infrastructure/persistence/RequerimientoInsumoItemJpaEntity.java` | Created | `requerimiento_insumo_item` mapping; `@GeneratedValue(IDENTITY)` child, FK owned by the parent association |
| `backend/.../proveedores/infrastructure/persistence/OfertaInsumoJpaEntity.java` | Created | `oferta_insumo` mapping; scalar `requerimiento_id`/`proveedor_id`; **no `precio_total`**; `@Version` |
| `backend/.../proveedores/infrastructure/persistence/SpringDataRequerimientoInsumoRepository.java` | Created | Derived queries + `asignarSiDisponible` (`WHERE estado=SOLICITADO AND expira_en > :ahora`) + `expirarVencidos` |
| `backend/.../proveedores/infrastructure/persistence/SpringDataOfertaInsumoRepository.java` | Created | Derived queries + `aceptarSiVigente` + `resolverPendientesDe` + `expirarVencidas` |
| `backend/.../proveedores/infrastructure/repository/RequerimientoInsumoRepositoryAdapter.java` | Created | Adapter over the port; maps the request gate to the conditional UPDATE |
| `backend/.../proveedores/infrastructure/repository/OfertaInsumoRepositoryAdapter.java` | Created | Adapter over the port; maps accept/invalidate/expire to the conditional UPDATEs |
| `backend/.../proveedores/infrastructure/scheduling/ProgramadorExpiracionInsumo.java` | Created | `@Scheduled(fixedDelayString = "${app.insumos.barrido-ms:60000}")`: expires pending offers and resolves open requests |
| `backend/src/main/resources/schema.sql` | Modified | Additive `CREATE TABLE IF NOT EXISTS` for the three tables + 4 indexes; no `precio_total` |
| `backend/src/main/resources/application.properties` | Modified | `app.insumos.vigencia-ms` (900000) + `app.insumos.barrido-ms` (60000), env-overridable |
| `backend/.../test/.../proveedores/infrastructure/persistence/RequerimientoInsumoRepositoryTest.java` | Created | 10 `@DataJpaTest` tests: request+items round-trip, root gate win/expiry, `expirarVencidos`, offer expiry round-trip, offer accept gate, sibling invalidation, expiry sweep, per-offer `RECHAZADO`/`EXPIRADA`/`CANCELADA` persistence, pending listing |
| `backend/.../test/.../proveedores/infrastructure/persistence/RequerimientoInsumoConcurrenteIT.java` | Created | 1 `@SpringBootTest` concurrency test: two threads accept the same request → exactly one winner |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*RequerimientoInsumoRepositoryTest'` → `BUILD SUCCESSFUL`; `tests="10" failures="0" errors="0"`. |
| Concurrency test command and exact result | `cd backend && ./gradlew test --tests '*RequerimientoInsumoConcurrenteIT'` → `BUILD SUCCESSFUL`; `tests="1" failures="0" errors="0"`. Two threads race the root conditional UPDATE: exactly one wins, its offer is `ACEPTADA`, the sibling is `CANCELADA`. |
| Runtime harness command/scenario and exact result | `cd backend && ./gradlew bootRun --args="--spring.datasource.url=jdbc:h2:file:/tmp/opencode/slice9/coldday;AUTO_SERVER=TRUE;DB_CLOSE_DELAY=-1 --server.port=18080"` → `Started ColdDayApplication`. Live `INFORMATION_SCHEMA.COLUMNS` shows all three tables: `REQUERIMIENTO_INSUMO` (id, ot_id, tecnico_id, estado, observaciones, creada_en, expira_en, resuelta_en, version), `REQUERIMIENTO_INSUMO_ITEM` (id identity BIGINT, requerimiento_id, descripcion, cantidad), `OFERTA_INSUMO` (id, requerimiento_id, proveedor_id, estado, creada_en, expira_en, resuelta_en, version). `SELECT COUNT(*) ... TABLE_NAME='OFERTA_INSUMO' AND COLUMN_NAME='PRECIO_TOTAL'` → **0**. |
| Regression guard | `cd backend && ./gradlew test` → **375 tests / 4 failures**, the 4 failing classes exactly `ClientesApiIT` (frozen out-of-scope baseline; 364 → 375 from the 11 new slice-9 tests). No new regressions. |
| `schema-postgres.sql` | **No change needed** — suppliers/insumos are not spatially queried and no PostGIS artifact is introduced; `ddl-auto=update` derives the tables from the entity mappings (design schema section). |
| Rollback boundary | The 2 ports, 3 entities, 2 SpringData repos, 2 adapters, `ProgramadorExpiracionInsumo`, the `schema.sql` three-table block, the `app.insumos.*` keys and the 2 test files. No `ot`/tariff/auxiliar behavior, no use case, no controller, no frontend. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*RequerimientoInsumoRepositoryTest'` → **BUILD SUCCESSFUL**, 10 tests / 0 failures
3. `cd backend && ./gradlew test --tests '*RequerimientoInsumoConcurrenteIT'` → **BUILD SUCCESSFUL**, 1 test / 0 failures
4. Runtime harness (above): the three tables exist with the expected columns; `precio_total` count = 0
5. `cd backend && ./gradlew test` → **375 tests / 4 failures**, all 4 `ClientesApiIT`

## Budget

Authored changed lines for this slice: **1,020** (implementation + tests, all tracked additions; measured with `git diff --cached --numstat`). With the merged apply-progress section the combined work unit is ~1,090, over the 1,060 hard budget. The 1,020 lines are one cohesive work unit (three-table persistence + gates + adapters + sweeper + tests); one honest pass found no cohesive split — the tests must travel with the behavior (work-unit-commits) and trimming would delete coverage. This slice already carries a forecast `size:exception` in `tasks.md` (slices 8–12). **Recommend `size:exception` for PR 9.**

## Deviations from Design

- **Items persisted as a cascaded `@OneToMany` child collection** instead of a third `SpringData*Repository`. The task names `RequerimientoInsumoItemJpaEntity` but only two `SpringData*Repository` interfaces; the lines are an owned, immutable composition, so cascade + `orphanRemoval` is the faithful mapping. It is infrastructure-only (the domain keeps `List<RequerimientoInsumoItem>`), and `applyFromDomain` never rewrites lines (immutable by domain contract), avoiding delete-and-reinsert churn.
- **`@Version` mapped on both `requerimiento_insumo` and `oferta_insumo`** per the design's candidate DDL (`version BIGINT`); the `ot` offer table omits it, but the design explicitly lists it here, so the entity and `schema.sql` stay in lockstep.
- **The sweeper calls the repository expiry primitives directly** (`expirarVencidas`/`expirarVencidos`), not a use case: `ExpirarInsumosUseCase` is slice 10 (task 6.3), so referencing it now would not compile. The sweep is a persistence-level conditional bulk UPDATE, exactly like `OfertaOtRepository.expirarDe`; slice 10 can re-point the bean at its use case.
- **Expired open requests resolve to `SIN_PROVEEDOR`** (the only negative, terminal-but-retriable root state) via the conditional `expirarVencidos` bulk UPDATE, satisfying D4's "unattended expiry resolves the request without blocking the OT".
- **`app.insumos.vigencia-ms` is added but not yet consumed** — it is the offer window slice 10's `SolicitarInsumoUseCase` will read; the sweeper reads only `app.insumos.barrido-ms`.

## Out of Scope (do not absorb)

- Slices 10–12: `SolicitarInsumoUseCase`/`AceptarInsumoUseCase`/`RechazarInsumoUseCase`/`EntregarInsumoUseCase`/`ExpirarInsumosUseCase`, `LoggingNotificacionInsumoAdapter`, `InsumoController`, diagnóstico wiring, frontend.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- The pre-existing frontend `app.spec.ts` failure — pre-existing, untouched by this slice.

---

# Slice 10 — Despacho use cases (PR 10 of the chained/stacked delivery)

Application layer + notification adapter + sweeper re-point (task 6.3). The REST controller, API records and the diagnóstico wiring (tasks 6.4–6.5) are slice 11; the frontend is slice 12.

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 6.3 | `SolicitarInsumoUseCase` (build the request from the free-text lines + broadcast to eligible suppliers), `AceptarInsumoUseCase` (atomic first-accept + sibling invalidation), `RechazarInsumoUseCase` (`RECHAZADO`), `EntregarInsumoUseCase` (AD8 delivery), `ExpirarInsumosUseCase` (offer expiry + request resolution); `LoggingNotificacionInsumoAdapter` (AD11/AD14, never throws); `ProgramadorExpiracionInsumo` re-pointed to `ExpirarInsumosUseCase`; `app.insumos.vigencia-ms` consumed as the offer window. | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../proveedores/application/usecases/SolicitarInsumoUseCase.java` | Created | Builds `RequerimientoInsumo` from the lines with a `app.insumos.vigencia-ms` window, broadcasts one pending `OfertaInsumo` per active supplier; empty lines → `Optional.empty()`; zero eligible → `SIN_PROVEEDOR`; notify AFTER the writes, inside try/catch |
| `backend/.../proveedores/application/usecases/AceptarInsumoUseCase.java` | Created | Eligibility gate → lazy offer/request expiry → `intentarAsignar` root gate → `intentarAceptar` → `invalidarPendientesDe(CANCELADA)`; loser mutates nothing |
| `backend/.../proveedores/application/usecases/RechazarInsumoUseCase.java` | Created | Records the explicit `RECHAZADO` literal for the holder without binding it |
| `backend/.../proveedores/application/usecases/EntregarInsumoUseCase.java` | Created | AD8: only the supplier whose offer is `ACEPTADA` for the request can move `ASIGNADO → ENTREGADO` |
| `backend/.../proveedores/application/usecases/ExpirarInsumosUseCase.java` | Created | Single sweep path: `expirarVencidas` + `expirarVencidos` under one clock/transaction; returns a `Resultado` record |
| `backend/.../proveedores/infrastructure/notification/LoggingNotificacionInsumoAdapter.java` | Created | AD11/AD14 logging adapter; records the dispatch event and never propagates an exception |
| `backend/.../proveedores/domain/exception/ProveedorNoElegibleException.java` | Created | Unknown/inactive/foreign supplier → 403 (slice-11 advice), never a 500 |
| `backend/.../proveedores/domain/exception/OfertaInsumoNoDisponibleException.java` | Created | Unknown/foreign/resolved/expired/losing offer → 409 |
| `backend/.../proveedores/domain/exception/RequerimientoInsumoNoEncontradoException.java` | Created | Missing request referenced by an offer → 404 |
| `backend/.../proveedores/infrastructure/scheduling/ProgramadorExpiracionInsumo.java` | Modified | Re-pointed from the repository expiry primitives to `ExpirarInsumosUseCase.expirar()` — one sweep path, no duplicate logic |
| `backend/.../test/.../proveedores/application/usecases/SolicitarInsumoUseCaseTest.java` | Created | 4 tests: fan-out + notify-after-write order, zero eligible, zero lines, notification-failure isolation |
| `backend/.../test/.../proveedores/application/usecases/AceptarInsumoUseCaseTest.java` | Created | 7 tests: winner + sibling invalidation, loser mutates nothing, unknown/inactive supplier, expired offer, expired request, foreign offer |
| `backend/.../test/.../proveedores/application/usecases/RechazarInsumoUseCaseTest.java` | Created | 3 tests: `RECHAZADO` recorded, foreign offer unavailable, ineligible supplier |
| `backend/.../test/.../proveedores/application/usecases/EntregarInsumoUseCaseTest.java` | Created | 3 tests: assigned supplier delivers, other supplier ineligible, already-delivered fails the transition guard |
| `backend/.../test/.../proveedores/application/usecases/ExpirarInsumosUseCaseTest.java` | Created | 2 tests: expires/resolves with counts, zero when nothing expired |
| `backend/.../test/.../proveedores/infrastructure/api/controllers/InsumoApiIT.java` | Created | 4 Spring-backed tests over the real H2 schema: broadcast → first-accept → deliver; inactive-supplier gate; zero eligible → `SIN_PROVEEDOR`; expiry sweep |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*SolicitarInsumoUseCaseTest' --tests '*AceptarInsumoUseCaseTest' --tests '*RechazarInsumoUseCaseTest' --tests '*EntregarInsumoUseCaseTest' --tests '*ExpirarInsumosUseCaseTest'` → `BUILD SUCCESSFUL`; `SolicitarInsumoUseCaseTest` 4/0, `AceptarInsumoUseCaseTest` 7/0, `RechazarInsumoUseCaseTest` 3/0, `EntregarInsumoUseCaseTest` 3/0, `ExpirarInsumosUseCaseTest` 2/0 (19 tests, 0 failures). |
| Integration test command and exact result | `cd backend && ./gradlew test --tests '*InsumoApiIT'` → `BUILD SUCCESSFUL`; `InsumoApiIT` 4/0 failures. Full Spring context boot + real repositories/H2. |
| Runtime harness command/scenario and exact result | **N/A at this slice** — the dispatch use cases can only be reached end-to-end through a controller, and the REST controller + diagnóstico wiring are slice 11. No HTTP path exists to exercise, so no harness was invented. The substitute proof is the Spring-backed `InsumoApiIT` above: the full application context boots with `LoggingNotificacionInsumoAdapter`, the five use cases and the re-pointed `ProgramadorExpiracionInsumo`, and the broadcast → first-accept → deliver, inactive-supplier, zero-eligible and expiry flows are proven against the real H2 schema. The end-to-end HTTP harness lands in slice 11. |
| Regression guard | `cd backend && ./gradlew test` → **398 tests / 4 failures**, the 4 failing classes exactly `ClientesApiIT` (the frozen out-of-scope baseline; 375 → 398 from the 23 new slice-10 tests). No new regressions. |
| Bounded-context direction check | `proveedores/application/**` and `proveedores/infrastructure/notification/**` import no `ot`/`tecnicos` domain types: the use cases receive `UUID otId`/`UUID tecnicoId` and return `RequerimientoInsumo`/`OfertaInsumo`. |
| Rollback boundary | The 5 use cases, `LoggingNotificacionInsumoAdapter`, the 3 domain exceptions, the `ProgramadorExpiracionInsumo` re-point and the 6 test files. No controller, no API request/response record, no diagnóstico wiring, no schema/`application.properties`, no frontend, no `ot`/tariff/auxiliar behavior. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*SolicitarInsumoUseCaseTest' --tests '*AceptarInsumoUseCaseTest' --tests '*RechazarInsumoUseCaseTest' --tests '*EntregarInsumoUseCaseTest' --tests '*ExpirarInsumosUseCaseTest'` → **BUILD SUCCESSFUL**, 19 tests / 0 failures
3. `cd backend && ./gradlew test --tests '*InsumoApiIT'` → **BUILD SUCCESSFUL**, 4 tests / 0 failures (the use-case subset that exists at this slice; slice 11 adds the HTTP subset)
4. Runtime harness → **N/A** (see Work Unit Evidence); proven with the Spring-backed `InsumoApiIT`
5. `cd backend && ./gradlew test` → **398 tests / 4 failures**, all 4 `ClientesApiIT`

## Budget

Authored changed lines (measured with `git diff --numstat` over the slice's paths):

- Implementation (9 new + 1 modified): **498** (476 additions + 22 deletions)
- Tests (6 new): **824**
- **Implementation + tests: 1,322** — over the 1,220 hard budget by **102 lines**.
- Merged apply-progress artifact: this section.

The 1,322 lines are one cohesive work unit: the five use cases + the notification adapter + the sweeper re-point are a single dispatch application layer, and the tests must travel with the behavior (work-unit-commits). One honest slicing pass found no cohesive split — splitting the use cases from each other or from their tests would break work-unit cohesion, and trimming would mean deleting tests/comments, which the review-budget rule forbids. This slice already carries a forecast `size:exception` in `tasks.md` (slices 8–12). **Recommend `size:exception` for PR 10**, consistent with the accepted exceptions on slices 2, 6, 7, 8 and 9.

## Deviations from Design

- **The use cases take `UUID otId`/`UUID tecnicoId`**, not the design's conceptual `solicitar(ot, tecnicoId, insumos, ahora)`. Passing the `Ot` aggregate would force `proveedores/application` to import `ot` domain types and invert the bounded-context direction; the trigger-side `RegistrarDiagnosticoUseCase` (slice 11) passes `ot.getId().valor()` and `tecnico.getId().valor()`.
- **`SolicitarInsumoUseCase` returns `Optional<RequerimientoInsumo>`** (empty when no lines) instead of relying on the caller to guard. This makes spec disp.R1's "zero insumos create nothing" hold at the use-case boundary and lets slice 11 call it unconditionally; the aggregate still requires ≥1 line.
- **`ExpirarInsumosUseCase` returns a nested `Resultado(int ofertasExpiradas, int requerimientosSinProveedor)`** record (not named in the task list) so the sweeper log and tests can observe the sweep outcome; the two counts are the existing repository primitives' return values.
- **Rejection and delivery persist via `save` on the loaded aggregate** (the domain methods enforce the state), because slice 9's `OfertaInsumoRepository` exposes no atomic reject primitive and this slice must not add persistence. Acceptance uses the existing atomic gate (`intentarAsignar` + `intentarAceptar`), so the concurrency-critical path stays race-free.
- **`InsumoApiIT` is created at the slice-11 controller path with only the use-case subset** (no MockMvc, no controller). It is the Spring-backed proof for this slice and slice 11 extends it with the HTTP subset, exactly as the tasks.md 6.5 file list anticipates.
- **No schema, `application.properties` or `schema-postgres.sql` change** — `app.insumos.vigencia-ms` already existed and is now consumed.

## Out of Scope (do not absorb)

- Slice 11: `InsumoController` + `InsumoControllerAdvice`, the API request/response records, the diagnóstico wiring (`DiagnosticoApiRequest`/`DiagnosticoRequest`/`OtController`/`RegistrarDiagnosticoUseCase`), the HTTP subset of `InsumoApiIT` and `AceptacionInsumoConcurrenteIT`.
- Slice 12: frontend DTO/mapper/mock, supplier portal, técnico/client pages, routes/menu/auth.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- The pre-existing frontend `app.spec.ts` failure — pre-existing, untouched by this slice.

---

# Slice 11 — Despacho API + wiring (PR 11 of the chained/stacked delivery)

REST surface + diagnóstico wiring (tasks 6.4–6.5). The frontend feature surfaces (task 6.6) are slice 12; integration/verify/docs are slice 13.

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 6.4 | Diagnóstico wiring: `insumos` on the wire (`DiagnosticoApiRequest` + `InsumoLineaApiRequest`) and the DTO (`DiagnosticoRequest`); `RegistrarDiagnosticoUseCase` triggers `SolicitarInsumoUseCase` after the diagnosis is persisted; zero insumos create nothing; non-assigned → 403 and no request (existing guard). AD5: the lines stay out of the `diagnostico` JSON column. | `[x]` |
| 6.5 | API + tests: `InsumoController` (listing, aceptar, rechazar, entregar) with `@PreAuthorize('PROVEEDOR')` + `InsumoControllerAdvice`; `ListarSolicitudesProveedorUseCase` + the response records; first-wins, concurrency one-winner/one-409 **over HTTP**, late accept, reject, delivery, zero eligible, ineligible supplier 403 **(b)**, notification failure leaves state intact **(c, slice-10 proof)**; budget/liquidación unaffected (untouched). | `[x]` |
| 6.6 (partial — AD12 only) | Frontend contract cleanup: the vestigial, mapper-dropped `repuestosSugeridos` is replaced by `insumos: InsumoLinea[]` in `common.models.ts` + `backend.dto.ts` + `backend.mappers.ts` and the 4 `mock-db.service.ts` literals. No UI pages (slice 12). | `[x]` |

## Endpoints exposed (slice 12 binds to these)

| Method / path | Auth | Success | Errors |
|---|---|---|---|
| `GET /api/proveedores/me/solicitudes` | `PROVEEDOR` | 200 `OfertaInsumoApiResponse[]` (offer + embedded `SolicitudInsumoApiResponse` request with its `items`) | 401, 403 |
| `POST /api/insumos/{ofertaId}/aceptar` | `PROVEEDOR` | 200 `SolicitudInsumoApiResponse` (`estado=ASIGNADO`) | 400 malformed id, 401, 403, 409 |
| `POST /api/insumos/{ofertaId}/rechazar` | `PROVEEDOR` | 200 `OfertaInsumoApiResponse` (`estado=RECHAZADO`) | 400, 401, 403, 409 |
| `POST /api/insumos/{id}/entregar` | `PROVEEDOR` | 200 `SolicitudInsumoApiResponse` (`estado=ENTREGADO`) | 400, 401, 403, 404, 409 |

`POST /api/ot/{id}/diagnostico` now accepts `insumos?: [{descripcion, cantidad}]`: 200 (EN_DIAGNOSTICO), 400 (blank description / quantity < 1 / ill-typed body), 401, 403 (non-assigned technician). `OfertaInsumoApiResponse` = `{id, requerimientoId, proveedorId, estado, creadaEn, expiraEn, resueltaEn, requerimiento}`; `SolicitudInsumoApiResponse` = `{id, otId, tecnicoId, estado, observaciones, items:[{descripcion,cantidad}], creadaEn, expiraEn, resueltaEn}`.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/.../proveedores/application/dto/SolicitudProveedor.java` | Created | Read projection pairing a pending offer with its request (offer id to act on + lines to display) |
| `backend/.../proveedores/application/usecases/ListarSolicitudesProveedorUseCase.java` | Created | Supplier poll: eligibility gate, pending + still-vigente offers with their requests; lazy expiry via the shared `Clock` |
| `backend/.../proveedores/infrastructure/api/responses/SolicitudInsumoApiResponse.java` | Created | Request view (root state + free-text lines) |
| `backend/.../proveedores/infrastructure/api/responses/OfertaInsumoApiResponse.java` | Created | Offer view, embedding the request when the caller holds it |
| `backend/.../proveedores/infrastructure/api/controllers/InsumoController.java` | Created | `GET /api/proveedores/me/solicitudes` + the three `POST /api/insumos/**` actions, all `@PreAuthorize('PROVEEDOR')` |
| `backend/.../proveedores/infrastructure/api/controllers/InsumoControllerAdvice.java` | Created | Canonical `ApiError`: 403 ineligible, 409 unavailable/invalid-transition, 404 missing request, 400 malformed id |
| `backend/.../ot/infrastructure/api/requests/InsumoLineaApiRequest.java` | Created | Wire insumo line (`@NotBlank`/`@Min(1)`) mapping to the `InsumoLinea` VO → 400 instead of a 500 |
| `backend/.../ot/infrastructure/api/requests/DiagnosticoApiRequest.java` | Modified | Added optional `@Valid List<InsumoLineaApiRequest> insumos` |
| `backend/.../ot/application/dto/DiagnosticoRequest.java` | Modified | Added `List<InsumoLinea> insumos` + a legacy 4-arg delegating constructor |
| `backend/.../ot/application/usecases/RegistrarDiagnosticoUseCase.java` | Modified | Injects `SolicitarInsumoUseCase`; triggers the dispatch AFTER `otRepository.save`, passing `otId`/`tecnicoId` as UUIDs |
| `backend/.../ot/infrastructure/api/controllers/OtController.java` | Modified | Maps the wire lines to `InsumoLinea` and passes them through |
| `backend/.../ot/infrastructure/api/controllers/OtControllerAdvice.java` | Modified | `HttpMessageNotReadableException` → canonical 400 (ill-typed insumo quantity) |
| `backend/.../test/.../ot/application/usecases/RegistrarDiagnosticoUseCaseTest.java` | Modified | Constructor + 1 wiring test (lines handed to the dispatch) and an empty-list assertion |
| `backend/.../test/.../ot/infrastructure/api/controllers/OtDiagnosticoPresupuestoIT.java` | Modified | 3 end-to-end tests: insumos → request (outside the diagnóstico JSON); zero insumos → no request; non-assigned → 403 + no request |
| `backend/.../test/.../proveedores/infrastructure/api/controllers/InsumoApiIT.java` | Modified | 7 MockMvc tests: listing, accept, loser 409, reject, deliver, non-winner 403, unlinked supplier 403, unknown offer 409/request 404, malformed id 400, role/401 boundaries |
| `backend/.../test/.../proveedores/infrastructure/api/controllers/AceptacionInsumoConcurrenteIT.java` | Created | Two concurrent **HTTP** accepts → exactly one 200 and one 409; winner `ACEPTADA`, sibling `CANCELADA` |
| `frontend/.../core/shared/domain/models/common.models.ts` | Modified | `InsumoLinea` view model; `DiagnosticoRequest.insumos` replaces `repuestosSugeridos` (AD12) |
| `frontend/.../core/shared/infrastructure/api/backend.dto.ts` | Modified | `InsumoLineaApi` + optional `insumos` on `DiagnosticoApiRequest` |
| `frontend/.../core/shared/infrastructure/api/backend.mappers.ts` | Modified | `aDiagnosticoApiRequest` now maps `insumos` |
| `frontend/.../core/shared/infrastructure/mock/mock-db.service.ts` | Modified | The 4 `repuestosSugeridos` literals became `insumos: [{descripcion, cantidad}]` |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd backend && ./gradlew test --tests '*InsumoApiIT' --tests '*AceptacionInsumoConcurrenteIT' --tests '*OtDiagnosticoPresupuestoIT' --tests '*RegistrarDiagnosticoUseCaseTest'` → `BUILD SUCCESSFUL`; `InsumoApiIT` 11/0, `AceptacionInsumoConcurrenteIT` 1/0, `OtDiagnosticoPresupuestoIT` 11/0, `RegistrarDiagnosticoUseCaseTest` 4/0 failures. |
| Runtime harness command/scenario and exact result | `cd backend && ./gradlew bootRun --args="--server.port=18090 --spring.datasource.url=jdbc:h2:file:/tmp/opencode/slice11/coldday;AUTO_SERVER=TRUE;DB_CLOSE_DELAY=-1 --spring.jpa.hibernate.ddl-auto=update --app.dispatch.escalamiento-ms=3600000 --app.insumos.barrido-ms=3600000"` + a real HTTP walk. **Observed status codes:** diagnóstico with insumo lines → **200** `EN_DIAGNOSTICO`; `GET /api/proveedores/me/solicitudes` → **200** with `{estado:PENDIENTE, requerimiento.items:[{Filtro secadora,2},{Bimetalico L55,1}]}`; first accept → **200** `ASIGNADO`; losing accept → **409**; non-winner `entregar` → **403**; winner `entregar` → **200** `ENTREGADO`; técnico listing → **403**; anonymous → **401**; malformed id → **400**; unknown request `entregar` → **404**; blank/zero insumo → **400** with field errors; **zero-insumos diagnóstico → 200** `EN_DIAGNOSTICO` and the supplier's pending list stayed at 0 (no request created). |
| Regression guard | `cd backend && ./gradlew test` → **410 tests / 4 failures**, the 4 failing classes exactly `ClientesApiIT` (the frozen out-of-scope baseline; 398 → 410 from the 12 new slice-11 tests). No new regressions. |
| Frontend guard | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npm run build` → **BUILD SUCCESSFUL**. `grep repuestosSugeridos frontend/src` → only the two AD12 removal comments remain, no code usage. |
| Bounded-context direction check | `proveedores/**` still imports no `ot`/`tecnicos` domain types. The dependency is one-way: `ot/application` + `ot/infrastructure` import `proveedores/application` (`SolicitarInsumoUseCase`) and `proveedores/domain/valueobjects/InsumoLinea`, exactly as slice 10 anticipated. |
| Rollback boundary | The 7 new `proveedores` API/application files, the new `InsumoLineaApiRequest`, the `DiagnosticoApiRequest`/`DiagnosticoRequest`/`OtController`/`OtControllerAdvice`/`RegistrarDiagnosticoUseCase` edits, the 4 test files (2 modified + 2 created — `InsumoApiIT` is modified, `AceptacionInsumoConcurrenteIT` created) and the 4 frontend contract files. No schema, no `application.properties`, no `SecurityConfig`/JWT, no `ot` aggregate/tariff/auxiliar behavior, no routes/menu/UI. |

## Verification

1. `cd backend && ./gradlew compileJava compileTestJava` → **BUILD SUCCESSFUL**
2. `cd backend && ./gradlew test --tests '*InsumoApiIT' --tests '*AceptacionInsumoConcurrenteIT'` → **BUILD SUCCESSFUL**, 12 tests / 0 failures
3. Runtime harness (above): full broadcast → first-accept → deliver over HTTP, zero-insumos unchanged; every status code as designed
4. `cd backend && ./gradlew test` → **410 tests / 4 failures**, all 4 `ClientesApiIT`
5. `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npm run build` → **BUILD SUCCESSFUL**

## Budget

Authored changed lines for this slice (measured with `git diff --numstat` + `wc -l` on new files):

- Implementation + tests: **923** (904 additions + 19 deletions across 20 files: 12 modified + 8 created).
- Merged apply-progress section included in the same commit.
- **Combined work unit: ~1,040.**

**Within the 1300-line hard budget.** No `size:exception` needed for slice 11 (unlike slices 2, 6–10, whose exceptions were already recorded).

## Deviations from Design

- **`ListarSolicitudesProveedorUseCase` + `SolicitudProveedor` + two response records added** (not named in the task file list). The design's `GET /api/proveedores/me/solicitudes` row returns pending `OfertaInsumo[]`, but slice 10 shipped no listing use case and the controller must not query repositories. The application projection pairs each offer with its request so the portal gets the offer id *and* the declared lines in one call; the response records are the wire shape slice 12 binds to.
- **The dispatch is triggered unconditionally** with `request.insumos()` (possibly empty). Slice 10 explicitly documented that `SolicitarInsumoUseCase.solicitar` returns empty for zero lines "and lets slice 11 call it unconditionally", so the "zero lines create nothing" rule has a single owner (the use case) instead of a duplicated caller guard.
- **`InsumoControllerAdvice` maps `MethodArgumentTypeMismatchException` → 400** so a malformed UUID path is the canonical `ApiError`, not Spring's default ProblemDetail.
- **`OtControllerAdvice` gained `HttpMessageNotReadableException` → 400.** An ill-typed insumo quantity (`"dos"`) cannot bind, so `@Valid` never runs; without the handler it would surface as a 500.
- **Unknown offer on `aceptar` is 409, not 404.** Slice 10's `AceptarInsumoUseCase` throws `OfertaInsumoNoDisponibleException` (409) for an unknown/foreign/resolved/losing offer, and `RequerimientoInsumoNoEncontradoException` (404) only when the offer references a missing request. The task's "404 missing request or offer" is satisfied by the `entregar` path (missing request → 404); the accept path follows the design/slice-10 exception contract exactly.
- **Reject returns `OfertaInsumoApiResponse` while accept/deliver return `SolicitudInsumoApiResponse`.** `RechazarInsumoUseCase` returns the offer (not the request), so the reject response is offer-centric; the design only mandates the resulting `RECHAZADO` literal there.
- **No UI change and no routes/menu/auth** — the frontend edits are the AD12 contract cleanup only; slice 12 owns the pages.
- **No schema / `application.properties` / `schema-postgres.sql` change** — persistence was complete in slice 9 and the sweeper reads existing keys.

## Out of Scope (do not absorb)

- Slice 12: supplier portal module, técnico/client pages, routes/menu/auth, `environment.ts`, `cargo-visita.ts` (AD13).
- Slice 13: boot checks, baseline comparison, docs (`ARQUITECTURA.md`).
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- The pre-existing frontend `app.spec.ts` failure — pre-existing, untouched by this slice.

---

# Slice 12 — Frontend surfaces (PR 12 of the chained/stacked delivery)

The consumer-facing surfaces of task 6.6. Slices 1–11 already shipped every backend endpoint this UI consumes; **no backend file was touched**. Docs are slice 13.

## Completed Tasks

| ID | Objective | Status |
|---|---|---|
| 6.6 | Supplier portal module (domain/view model, real HTTP + mock branch, offer list with accept/reject/deliver, request lines, expiry, resolved state); technician auxiliar prompt at acceptance; technician diagnóstico insumo lines (AD12); client tariff display from `POST /api/ot/tarifa/estimar` (distance/source/out-of-range); `PROVEEDOR` route guard/routes/menu + dashboard redirect; slice-7 admin supplier page routed. | `[x]` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `frontend/.../domain/models/common.models.ts` | Modified | `EstadoRequerimiento`, `OfertaInsumoEstado`, `SolicitudInsumoResponse`, `OfertaInsumoResponse` view models |
| `frontend/.../infrastructure/api/backend.dto.ts` | Modified | `SolicitudInsumoApiResponse` + `OfertaInsumoApiResponse` wire DTOs (exact contract) |
| `frontend/.../infrastructure/api/backend.mappers.ts` | Modified | `aSolicitudInsumoResponse` + `aOfertaInsumoResponse` (null-safe on the optional embedded request) |
| `frontend/.../infrastructure/mock/mock-db.service.ts` | Modified | `solicitudesProveedor` seed (pending/accepted/expired), `estimarTarifa` mock mirroring the bracket table, `aceptarInsumo`/`rechazarInsumo`/`entregarInsumo`; removed the `environment.diagnosticoPrecio/transportePrecio` history text |
| `frontend/.../modules/proveedores/infrastructure/proveedores-api.ts` | Created | Supplier facade: `getMisSolicitudes`, `aceptar`, `rechazar`, `entregar` with a `useMocks()` branch |
| `frontend/.../modules/proveedores/presentation/solicitudes-proveedor-page.ts` | Created | Portal: offer list, request lines, expiry, resolved state, accept/reject/deliver, human 409/403/404 messages, loading/empty/error states, `aria-live` |
| `frontend/.../modules/tecnicos/presentation/ofertas-page.ts` | Modified | Per-card auxiliar count (default 0, `0..app.auxiliares.max`), sent as the optional accept body; distance-based tariff copy |
| `frontend/.../modules/tecnicos/presentation/ejecucion-ot-page.ts` | Modified | `FormArray` of insumo lines (descripción/cantidad) with add/remove; zero lines valid; sent in the diagnóstico |
| `frontend/.../modules/ot/infrastructure/ot-api.ts` | Modified | `estimarTarifa(punto)` → `POST /api/ot/tarifa/estimar` with a mock branch |
| `frontend/.../modules/ot/components/cargo-visita.ts` | Modified | Replaced the fixed 40.000 + 20.000 with the real estimate: distance, `ROAD`/`LINEAL`, honest out-of-range, loading/error states |
| `frontend/.../modules/clientes/presentation/seguimiento-ot-page.ts` | Modified | Passes `[punto]="orden.punto"` to the cargo component |
| `frontend/.../modules/clientes/presentation/diagnostico-ot-page.ts` | Modified | Visit row + total use the real estimate (distance/source/out-of-range) |
| `frontend/.../modules/clientes/presentation/pago-acta-page.ts` | Modified | Payment breakdown uses the real estimate (was the same static constants) |
| `frontend/src/environments/environment.ts` | Modified | Removed `diagnosticoPrecio`/`transportePrecio`; added `auxiliaresMax: 10` |
| `frontend/.../app.routes.ts` | Modified | Added `proveedor/panel` (PROVEEDOR) and routed the slice-7 `admin/proveedores` (ADMINISTRADOR) |
| `frontend/.../layout/app.menu.ts` | Modified | Proveedor section (supplier portal) + admin `Proveedores` entry |
| `frontend/.../auth/auth.service.ts` | Modified | `getDashboardRouteForRole('PROVEEDOR')` → `/proveedor/panel`; PROVEEDOR demo profile |
| `frontend/.../presentation/panel-redirect.ts` | Modified | `PROVEEDOR` → `/proveedor/panel` |
| `frontend/.../usuarios/presentation/login-page.ts` | Modified | Proveedor demo quick-login |
| `frontend/.../mock/mock-db.service.spec.ts` | Created | 9 tests: supplier lifecycle (409/404) + tariff table |
| `frontend/.../api/backend.mappers.spec.ts` | Created | 3 tests: insumo mappers |
| `frontend/.../layout/app.menu.spec.ts` | Created | 3 tests: role→menu wiring |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `cd frontend && npm run build && npm run test` → build `BUILD SUCCESSFUL`; test **15 passed / 1 failed** (the 1 failure is the pre-existing `app.spec.ts`, see below). New coverage: `mock-db.service.spec.ts` 9/9, `backend.mappers.spec.ts` 3/3, `app.menu.spec.ts` 3/3. |
| Runtime harness command/scenario and exact result | **Partial.** `cd frontend && npm run dev` (port 3000) → `Application bundle generation complete`; all touched routes served **HTTP 200** (`/`, `/proveedor/panel`, `/admin/proveedores`, `/tecnico/ofertas`, `/cliente/ot/OT-2026-001`) and the SPA shell rendered. The **interactive role walkthrough was not driven**: this environment has no headless browser (no chromium/chrome/firefox, no playwright/puppeteer). Substitute proof: the production build emits the lazy chunk `solicitudes-proveedor-page`, the mock-mode tests exercise the supplier accept/reject/deliver + 409/404 lifecycle and the tariff table, and `app.menu.spec.ts` proves the role→menu wiring. |
| Rollback boundary | `modules/proveedores/**` (2 new files), the 5 spec files, and the 17 modified frontend files (contract models/dto/mappers/mock, ot-api, cargo-visita, the 4 pages, routes/menu/auth/panel-redirect/login, environment). No backend Java, no `schema.sql`, no planning artifact except this file. |

## Verification

1. `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 0
2. `cd frontend && npm run build` → **BUILD SUCCESSFUL** (lazy chunk `solicitudes-proveedor-page` emitted)
3. `cd frontend && npm run test` → **15 passed / 1 failed**. Proven pre-existing: stashing this slice's files and re-running reproduced the identical `TypeError: Cannot read properties of undefined (reading 'getItem')` at `layout.service.ts:72` (`LayoutService.restore`), the same failure as the pre-change baseline.
4. Runtime harness → **partial** (dev server boots and serves every touched route 200; no browser available for the interactive walkthrough)
5. AD12: `rg repuestosSugeridos frontend/src` → only the two removal comments, no code usage
6. AD13 (backend, already slice 3): `rg TARIFA_VISITA_BASE backend/src` → none; frontend `rg "diagnosticoPrecio|transportePrecio"` → none
7. `git status` → no backend Java / `schema.sql` change

## Budget

Authored changed lines (measured with `git diff --numstat` + `wc -l` on new files):

- Modified tracked: **+674 / -62 = 736**
- New files (2 implementation + 3 spec): **641**
- **Implementation + tests: 1,377** — within the ≤1400 hard budget.
- The merged apply-progress section is additional. This slice carries the forecast `size:exception` recorded in `tasks.md` (slices 8–12).

## Deviations from Design

- **The estimate is consumed from the OT's `punto`** (`POST /api/ot/tarifa/estimar` is keyed on the destination coordinates, not the OT id). `seguimiento-ot-page`, `diagnostico-ot-page` and `pago-acta-page` already had `orden.punto`, so no new backend contract was needed.
- **`pago-acta-page.ts` also updated** although the prompt listed `cargo-visita.ts`: it was the third reader of the removed `environment.diagnosticoPrecio/transportePrecio`, and leaving it would have kept the hardcoded charge (and failed the type-check once the keys were deleted).
- **The supplier portal renders its own state badges** instead of extending the shared `EstadoBadge`, whose union does not cover `OfertaInsumoEstado`/`EstadoRequerimiento`; this keeps the shared component untouched.
- **Mock errors are `ApiHttpError`** (409/404) so the portal's status-based messaging behaves the same in `useMocks()` mode as against the real interceptor.
- **`tasks.md` not edited** — the planning artifact is read-only for this slice and is table-based (no `- [ ]` checkboxes); completion is recorded here.

## Out of Scope (do not absorb)

- Slice 13: boot checks, baseline comparison, docs (`ARQUITECTURA.md`).
- Backend behaviour, `schema.sql`, and any planning artifact other than this file.
- The 4 `ClientesApiIT` baseline failures — pre-existing, untouched.
- The pre-existing frontend `app.spec.ts` failure — pre-existing, reproduced without this slice.
