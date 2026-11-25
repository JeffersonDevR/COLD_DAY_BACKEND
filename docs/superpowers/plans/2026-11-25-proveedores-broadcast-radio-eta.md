# Proveedores: difusión por radio, ETA y despacho — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La solicitud de repuestos se difunde solo a proveedores validados dentro de un radio que escala 10→25 km; quien acepta fija un ETA, despacha y entrega, y el técnico lo ve con push.

**Architecture:** Se amplía el contexto `proveedores` (agregado `RequerimientoInsumo`, `OfertaInsumo`, casos de uso, scheduler) siguiendo el patrón de radio de las OT. `proveedores` no importa tipos de dominio de `ot`/`tecnicos`: el destino llega como `Point` y los ids como `UUID`. Móvil: se ajusta `solicitudes-proveedor` y la sección Repuestos de `ejecucion-ot`.

**Tech Stack:** Spring Boot 4 / Java 25 / PostGIS / Flyway / JUnit + Testcontainers; Angular 21 + Ionic 9 + Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-proveedores-broadcast-radio-eta-design.md`

## Global Constraints

- Leer completo `docs/backend/GUIA-BACKEND.md` y (móvil) `DESIGN.md`/`PRODUCT.md` antes de editar; correr `node backend/scripts/check-backend-rules.mjs` (backend) y `cd frontend && npm run ui:check` (móvil) **antes y después**; techos solo bajan; prohibido editar a mano los `*.baseline.json`.
- Flyway append-only: solo se crea `V21__…sql`; no se edita ninguna migración previa (la última es V20).
- `proveedores` no importa tipos de dominio de `ot`/`tecnicos`/`usuarios`; ids como `UUID`, ubicación como `com.sena.cold_day.core.shared.domain.Point(double latitud, double longitud)`.
- Radio inicial 10 km, +5 km por ventana, máximo 25 km; ventana = `app.insumos.vigencia-ms` ÷ 4 (≈ 3 min con 900000 ms). Propiedades nuevas: `app.insumos.radio-inicial-km=10`, `app.insumos.radio-maximo-km=25`, `app.insumos.incremento-km=5`, `app.insumos.velocidad-kmh=30`, `app.insumos.eta-maximo-minutos=240` (valores por defecto de Claude, no política de producto).
- Elegible = activo + `estadoValidacion == APROBADO` + ubicación no nula + dentro del radio. `categoriasInsumo` NO filtra.
- Distancia en línea recta con PostGIS (`ST_DWithin`/`ST_Distance` sobre `geography`), como `PostgisTecnicoDisponibilidadAdapter`.
- Notificaciones best-effort: tras escribir, nunca lanzan, nunca cambian el estado persistido.
- Sin `@Disabled`, sin aflojar tests; los tests existentes solo cambian donde cambia el comportamiento (marcados abajo).
- Copy móvil en tuteo, español de Colombia; no inventar precios/SLA.
- Commits: `tipo(ámbito): mensaje` en español, uno por tarea, **solo si el usuario lo pide** (AGENTS.md regla 7); si no, dejar el árbol listo.
- Desviación respecto al diseño: al escalar, las ofertas ya enviadas **siguen vigentes** hasta `expiraEn` del requerimiento (no se expiran por ventana), para no quitarle la opción a un proveedor cercano que aún no responde; la escalada solo añade proveedores nuevos.

## Review Focus

1. Proveedor sin ubicación o no validado/inactivo: no recibe oferta y no provoca 500 (Task 3, 4).
2. Un proveedor ya ofertado no recibe una segunda oferta al escalar; sin nadie en 25 km el requerimiento termina `SIN_PROVEEDOR` al vencer (Task 5, 6).
3. ETA nulo, 0, negativo o mayor al tope → 400 y nada cambia (Task 7).
4. Otro proveedor (no ganador) no puede despachar ni entregar → 403; entregar sin despachar → 409 (Task 8).
5. Filas previas a V21 (radio/ETA nulos) siguen leyéndose y vencen como antes; el barrido de escalado las ignora (Task 1, 6).
6. Un fallo de push no cambia estado ni propaga excepción (Task 9).

---

### Task 1: Migración V21 + dominio y persistencia del requerimiento/oferta

**Files:**
- Create: `backend/src/main/resources/db/migration/V21__insumos_radio_eta_despacho.sql`
- Modify: `proveedores/domain/valueobjects/EstadoRequerimiento.java`, `proveedores/domain/services/TransicionesRequerimiento.java`, `proveedores/domain/aggregates/RequerimientoInsumo.java`, `proveedores/domain/entities/OfertaInsumo.java`, `proveedores/infrastructure/persistence/RequerimientoInsumoJpaEntity.java`, `OfertaInsumoJpaEntity.java`
- Test: `RequerimientoInsumoTest`, `OfertaInsumoTest`, `RequerimientoInsumoRepositoryTest`, y el test de transiciones existente de `TransicionesRequerimiento` (ubicarlo con Glob)

**Interfaces:**
- Produces (V21): `requerimiento_insumo` gana `radio_km double precision NULL`, `ventana_expira_en timestamptz NULL`, `destino_latitud double precision NULL`, `destino_longitud double precision NULL`, `eta_minutos integer NULL`, `distancia_km double precision NULL`, `aceptada_en timestamptz NULL`, `despachada_en timestamptz NULL`, `eta_aviso_en timestamptz NULL`; `oferta_insumo` gana `distancia_km double precision NULL`, `eta_sugerido_minutos integer NULL`; se **reemplaza** `requerimiento_insumo_estado_check` para incluir `'DESPACHADO'`.
- Produces: `EstadoRequerimiento.DESPACHADO`; transiciones `ASIGNADO→DESPACHADO`, `DESPACHADO→ENTREGADO` (se elimina `ASIGNADO→ENTREGADO`).
- Produces en `RequerimientoInsumo`: `crear(UUID otId, UUID tecnicoId, List<InsumoLinea> lineas, String observaciones, Instant creadaEn, Instant expiraEn, Point destino, double radioKm, Instant ventanaExpiraEn)`; `void escalar(double nuevoRadioKm, Instant nuevaVentanaExpiraEn)`; `void asignar(int etaMinutos, Double distanciaKm, Instant ahora)`; `void despachar(Instant ahora)`; getters `getDestino(): Point`, `getRadioKm(): Double`, `getVentanaExpiraEn()`, `getEtaMinutos(): Integer`, `getDistanciaKm(): Double`, `getAceptadaEn()`, `getDespachadaEn()`, `getEtaAvisoEn()`, `marcarEtaAvisado(Instant)`. `reconstituir(...)` recibe todos los campos nuevos al final. Un requerimiento legado tiene `destino/radioKm/ventana` nulos y sigue siendo válido.
- Produces en `OfertaInsumo`: `crear(RequerimientoInsumoId, ProveedorId, Instant creadaEn, Instant expiraEn, double distanciaKm, int etaSugeridoMinutos)`; getters `getDistanciaKm(): Double`, `getEtaSugeridoMinutos(): Integer` (nulables en filas legadas).

- [ ] **Step 1: Tests que fallan** — en `RequerimientoInsumoTest`: `asignar_exige_eta_positivo`, `despachar_solo_desde_asignado`, `entregar_exige_despachado` (ASIGNADO→ENTREGADO lanza `TransicionRequerimientoInvalidaException`), `escalar_solo_en_solicitado_y_sube_radio`. En `OfertaInsumoTest`: `crear_guarda_distancia_y_eta_sugerido`. En el test de `RequerimientoInsumoRepositoryTest` (patrón existente): `persiste_y_relee_destino_radio_eta_y_estado_despachado`; y `fila_legada_sin_radio_se_lee_con_nulos`.
- [ ] **Step 2: Ejecutar** `cd backend; .\gradlew.bat test --tests "*RequerimientoInsumo*" --tests "*OfertaInsumoTest*"` → falla por símbolos inexistentes.
- [ ] **Step 3: Implementar** migración V21 (columnas nulables, sin backfill; `ALTER TABLE … DROP CONSTRAINT requerimiento_insumo_estado_check` + `ADD CONSTRAINT` con los cinco estados), enum, tabla de transiciones (actualizar su javadoc), agregado y entidades JPA con las firmas de arriba. `asignar` valida `etaMinutos >= 1`.
- [ ] **Step 4: Ejecutar** los mismos tests → PASS. **Cambio de comportamiento a reflejar** en los tests existentes que entregaban desde `ASIGNADO` (`EntregarInsumoUseCaseTest`, `InsumoApiIT`): se corrigen en Task 8, aquí pueden quedar rojos solo esos; anotar cuáles.
- [ ] **Step 5: Commit** `feat(proveedores): migracion V21 y modelo de radio, ETA y despacho`

### Task 2: Cálculo del ETA sugerido

**Files:**
- Create: `proveedores/domain/services/CalculadoraEtaInsumo.java`
- Test: `proveedores/domain/services/CalculadoraEtaInsumoTest.java`

**Interfaces:**
- Produces: `public final class CalculadoraEtaInsumo` con `CalculadoraEtaInsumo(double velocidadKmh, int etaMaximoMinutos)`, `int sugerir(double distanciaKm)` → `max(1, ceil(distanciaKm / velocidadKmh * 60))` acotado a `etaMaximoMinutos`, y `void validar(int etaMinutos)` → lanza `IllegalArgumentException("El ETA debe estar entre 1 y N minutos")` si `< 1` o `> etaMaximoMinutos`. Se registra como bean en una `@Configuration` de `proveedores/infrastructure` leyendo `app.insumos.velocidad-kmh` y `app.insumos.eta-maximo-minutos`.

- [ ] **Step 1: Test** `sugerir_15km_a_30kmh_son_30_min`, `sugerir_0_5km_minimo_1_minuto`, `sugerir_nunca_supera_el_tope`, `validar_rechaza_0_negativo_y_sobre_tope` (con 30 km/h y tope 240).
- [ ] **Step 2:** `.\gradlew.bat test --tests "*CalculadoraEtaInsumoTest"` → FAIL.
- [ ] **Step 3:** Implementar clase y configuración.
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5: Commit** `feat(proveedores): calculo del ETA sugerido por distancia`

### Task 3: Búsqueda espacial de proveedores elegibles

**Files:**
- Modify: `proveedores/domain/repository/ProveedorRepository.java`, `infrastructure/repository/ProveedorRepositoryAdapter.java`
- Create: `proveedores/domain/valueobjects/ProveedorCercano.java`
- Test: `ProveedorRepositoryTest` (patrón Testcontainers existente)

**Interfaces:**
- Produces: `record ProveedorCercano(ProveedorId proveedorId, double distanciaKm)`; `List<ProveedorCercano> ProveedorRepository.buscarElegiblesEnRadio(Point centro, double radioKm)` ordenada por distancia ascendente. Query nativa vía `EntityManager` replicando `PostgisTecnicoDisponibilidadAdapter` (`ST_MakePoint(longitud, latitud)::geography`, `ST_DWithin`, `ST_Distance/1000.0`) sobre `proveedor` con `activo = true AND estado_validacion = 'APROBADO' AND latitud IS NOT NULL AND longitud IS NOT NULL`. `centro == null` → `IllegalArgumentException`.

- [ ] **Step 1: Tests** `devuelve_solo_aprobados_activos_con_ubicacion_dentro_del_radio`, `excluye_pendiente_suspendido_inactivo_y_sin_ubicacion`, `ordena_por_distancia_y_expone_km`, `borde_fuera_del_radio_no_entra` (usar dos puntos de Bogotá a ~9 km y ~11 km con radio 10).
- [ ] **Step 2:** `.\gradlew.bat test --tests "*ProveedorRepositoryTest"` → FAIL.
- [ ] **Step 3:** Implementar puerto, VO y adaptador.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(proveedores): busqueda espacial de proveedores elegibles por radio`

### Task 4: Captura de la ubicación del proveedor (backend)

**Files:**
- Modify: `proveedores/domain/aggregates/Proveedor.java`, `application/usecases/GestionarMiPerfilProveedorUseCase.java`, `application/dto/ProveedorResponse.java`, `infrastructure/api/controllers/ProveedorController.java`, `infrastructure/api/responses/ProveedorApiResponse.java`
- Create: `infrastructure/api/requests/UbicacionProveedorApiRequest.java`
- Test: `ProveedorTest`, `ProveedorApiIT`

**Interfaces:**
- Produces: `void Proveedor.fijarUbicacion(Point ubicacion)` (no nulo); `ProveedorResponse fijarUbicacion(UsuarioId usuarioId, double latitud, double longitud)` en `GestionarMiPerfilProveedorUseCase`; `PUT /api/proveedores/me/ubicacion` con body `{latitud, longitud}` (`@NotNull`, rangos −90..90 / −180..180), `@PreAuthorize("hasRole('PROVEEDOR')")`, responde `ProveedorApiResponse`. `ProveedorResponse` y `ProveedorApiResponse` ganan `Double latitud, Double longitud` (nulos si no hay ubicación) — también expuestos en `GET /api/proveedores/me`.

- [ ] **Step 1: Tests** `ProveedorTest.fijarUbicacion_rechaza_nulo`; `ProveedorApiIT`: `put_ubicacion_persiste_y_get_me_la_devuelve`, `put_ubicacion_fuera_de_rango_es_400`, `put_ubicacion_sin_rol_proveedor_es_403`, `me_sin_ubicacion_devuelve_nulos`.
- [ ] **Step 2:** `.\gradlew.bat test --tests "*ProveedorTest" --tests "*ProveedorApiIT"` → FAIL.
- [ ] **Step 3:** Implementar (la entidad JPA ya mapea `latitud/longitud`).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(proveedores): el proveedor fija su ubicacion`

### Task 5: Difusión inicial por radio

**Files:**
- Modify: `proveedores/application/usecases/SolicitarInsumoUseCase.java`, `ot/application/usecases/RegistrarDiagnosticoUseCase.java`, `ot/application/usecases/SolicitarInsumosOtUseCase.java`, `proveedores/domain/repository/OfertaInsumoRepository.java` (+ adaptador y Spring Data)
- Create: `ot/domain/exception/UbicacionDestinoInsumosException.java` (+ mapeo 422 en el `ControllerAdvice` de `ot` que ya maneja `SolicitudInsumosInvalidaException`)
- Test: `SolicitarInsumoUseCaseTest`, tests de `RegistrarDiagnosticoUseCase`/`SolicitarInsumosOtUseCase`, `OfertaInsumoRepositoryAdapter` (en `InsumoApiIT` o test de repositorio)

**Interfaces:**
- Consumes: Tasks 1–3 (`RequerimientoInsumo.crear(...)` nueva, `OfertaInsumo.crear(...)` nueva, `buscarElegiblesEnRadio`, `CalculadoraEtaInsumo.sugerir`).
- Produces: `Optional<RequerimientoInsumo> SolicitarInsumoUseCase.solicitar(UUID otId, UUID tecnicoId, Point destino, List<InsumoLinea> lineas, String observaciones)`; y un método público reutilizable `int ofrecer(RequerimientoInsumo requerimiento, double radioKm, Instant ahora)` que crea `OfertaInsumo` (con `distanciaKm` y `etaSugeridoMinutos`, `expiraEn` = el del requerimiento) para cada proveedor del radio **que aún no tiene oferta de ese requerimiento**, notifica best-effort, y devuelve cuántas creó. `Set<ProveedorId> OfertaInsumoRepository.proveedoresOfertados(RequerimientoInsumoId)`.
- Comportamiento: sin líneas → `Optional.empty()` (igual que hoy). El requerimiento nace con `radioKm = app.insumos.radio-inicial-km`, `ventanaExpiraEn = ahora + vigenciaMs/4`. **Ya no** pasa a `SIN_PROVEEDOR` en el acto si nadie está en 10 km: sigue `SOLICITADO` y escala (Task 6); `SIN_PROVEEDOR` llega por vencimiento. Destino en los casos de uso de `ot`: `ot.getUbicacion()`, y si es nulo `tecnico.getUbicacion()`; si ambos nulos → `UbicacionDestinoInsumosException` → HTTP 422 y no se crea nada (en diagnóstico solo aplica si hay líneas).

- [ ] **Step 1: Tests** (`SolicitarInsumoUseCaseTest`): `crea_requerimiento_con_radio_10_y_ventana_un_cuarto_de_la_vigencia`; `ofrece_solo_a_proveedores_del_radio_con_distancia_y_eta_sugerido`; `sin_proveedores_en_radio_queda_solicitado_no_sin_proveedor`; `no_duplica_oferta_a_proveedor_ya_ofertado` (llamar `ofrecer` dos veces); `fallo_de_notificacion_no_cambia_lo_persistido`. En ot: `solicitar_insumos_usa_ubicacion_de_la_ot`, `usa_ubicacion_del_tecnico_si_la_ot_no_tiene`, `sin_ninguna_ubicacion_es_422_y_no_persiste`.
- [ ] **Step 2:** `.\gradlew.bat test --tests "*SolicitarInsumo*" --tests "*RegistrarDiagnostico*"` → FAIL.
- [ ] **Step 3:** Implementar. Ajustar los tests existentes de «cero elegibles ⇒ `SIN_PROVEEDOR` inmediato» al nuevo comportamiento (cambia por diseño).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(proveedores): difusion inicial por radio de 10 km`

### Task 6: Barrido de escalado de radio

**Files:**
- Create: `proveedores/application/usecases/EscalarRadioInsumosUseCase.java`
- Modify: `proveedores/domain/repository/RequerimientoInsumoRepository.java` (+ adaptador y `SpringDataRequerimientoInsumoRepository`), `proveedores/infrastructure/scheduling/ProgramadorExpiracionInsumo.java`
- Test: `EscalarRadioInsumosUseCaseTest`, `ExpirarInsumosUseCaseTest` (sin cambios de comportamiento), test del programador

**Interfaces:**
- Consumes: `SolicitarInsumoUseCase.ofrecer(...)` (Task 5), `RequerimientoInsumo.escalar(...)` (Task 1).
- Produces: `List<RequerimientoInsumo> RequerimientoInsumoRepository.buscarEscalables(Instant ahora)` → `estado = SOLICITADO AND radio_km IS NOT NULL AND ventana_expira_en <= :ahora AND expira_en > :ahora`; `int EscalarRadioInsumosUseCase.ejecutar()` devuelve cuántos escaló. Cada uno: si `radioKm < radio-maximo-km` → `escalar(min(radio+incremento, maximo), min(ahora+ventana, expiraEn))`, `save`, `ofrecer(...)`; si ya está en el máximo no hace nada (lo cierra `ExpirarInsumosUseCase` al vencer). Captura `OptimisticLockingFailureException` por requerimiento y sigue. El programador llama primero `escalarRadio.ejecutar()` y luego `expirarInsumos.expirar()` (un solo camino, mismo `app.insumos.barrido-ms`; por defecto bajarlo a 15000 ms para que la escalada sea puntual).

- [ ] **Step 1: Tests**: `escala_10_a_15_cuando_vence_la_ventana_y_ofrece_a_los_nuevos`; `no_toca_requerimientos_con_ventana_vigente`; `en_25_km_no_escala_mas`; `ignora_filas_legadas_sin_radio`; `un_conflicto_optimista_no_aborta_el_lote`; `ciclo_completo_sin_nadie_termina_SIN_PROVEEDOR_al_vencer` (escalar ×3 + expirar).
- [ ] **Step 2:** `.\gradlew.bat test --tests "*EscalarRadioInsumos*" --tests "*ExpirarInsumos*"` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(proveedores): escalado de radio de insumos 10 a 25 km`

### Task 7: Aceptar con ETA y vista del proveedor

**Files:**
- Modify: `AceptarInsumoUseCase.java`, `RequerimientoInsumoRepository.java` (+ adaptador/Spring Data: `intentarAsignar`), `ListarSolicitudesProveedorUseCase.java`, `InsumoController.java`, `OfertaInsumoApiResponse.java`, `SolicitudInsumoApiResponse.java`, `SolicitudProveedor.java` (si hace falta)
- Create: `infrastructure/api/requests/AceptarInsumoApiRequest.java`
- Test: `AceptarInsumoUseCaseTest`, `InsumoApiIT`, `AceptacionInsumoConcurrenteIT`, `RequerimientoInsumoConcurrenteIT`

**Interfaces:**
- Consumes: `CalculadoraEtaInsumo.validar(int)` (Task 2), `OfertaInsumo.getDistanciaKm()`.
- Produces: `RequerimientoInsumo AceptarInsumoUseCase.aceptar(UsuarioId usuarioId, OfertaInsumoId ofertaId, int etaMinutos)`; `int RequerimientoInsumoRepository.intentarAsignar(RequerimientoInsumoId id, Instant ahora, int etaMinutos, Double distanciaKm)` (el UPDATE condicional sigue siendo el único gate; además escribe `eta_minutos`, `distancia_km`, `aceptada_en`); `POST /api/insumos/{ofertaId}/aceptar` recibe `AceptarInsumoApiRequest(@NotNull @Min(1) Integer etaMinutos)`. ETA inválido (fuera de 1..tope) → 400 sin tocar nada. `GET /api/proveedores/me/solicitudes` devuelve ahora ofertas `PENDIENTE` vigentes **y** `ACEPTADA` cuyo requerimiento esté en `ASIGNADO` o `DESPACHADO`. `OfertaInsumoApiResponse` añade `Double distanciaKm`, `Integer etaSugeridoMinutos`; `SolicitudInsumoApiResponse` añade `Integer etaMinutos`, `Double distanciaKm`, `Instant aceptadaEn`, `Instant despachadaEn`, `Double radioKm`. Todos nulables (filas legadas).

- [ ] **Step 1: Tests**: `aceptar_guarda_eta_y_distancia`; `eta_0_negativo_y_sobre_tope_son_400_sin_mutar_nada`; `solo_un_ganador_con_eta` (los ITs de concurrencia existentes deben seguir verdes pasando un ETA); `listado_incluye_aceptadas_asignadas_y_despachadas`; `listado_no_incluye_entregadas_ni_ofertas_de_otro_proveedor`.
- [ ] **Step 2:** `.\gradlew.bat test --tests "*AceptarInsumo*" --tests "*InsumoApiIT" --tests "*Concurrente*"` → FAIL.
- [ ] **Step 3:** Implementar; actualizar los ITs existentes que llamaban `aceptar` sin ETA (cambia el contrato por diseño).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(proveedores): aceptar con ETA y listado de solicitudes en curso`

### Task 8: Despachar y entregar

**Files:**
- Create: `proveedores/application/usecases/DespacharInsumoUseCase.java`
- Modify: `EntregarInsumoUseCase.java`, `InsumoController.java`
- Test: `DespacharInsumoUseCaseTest`, `EntregarInsumoUseCaseTest`, `InsumoApiIT`

**Interfaces:**
- Produces: `RequerimientoInsumo DespacharInsumoUseCase.despachar(UsuarioId usuarioId, RequerimientoInsumoId id)` — mismas reglas de elegibilidad y de «oferta ACEPTADA de este proveedor» que `EntregarInsumoUseCase` (otro proveedor → `ProveedorNoElegibleException` 403), llama `requerimiento.despachar(ahora)` (409 por `TransicionRequerimientoInvalidaException` si no está `ASIGNADO`); `POST /api/insumos/{id}/despachar` (`hasRole('PROVEEDOR')`) → `SolicitudInsumoApiResponse`. `EntregarInsumoUseCase` pasa a exigir `DESPACHADO`.

- [ ] **Step 1: Tests**: `despacha_el_ganador`; `otro_proveedor_no_despacha_403`; `despachar_dos_veces_es_409`; `entregar_sin_despachar_es_409`; `entregar_despachado_ok`; `proveedor_que_perdio_aprobacion_no_despacha`.
- [ ] **Step 2:** `.\gradlew.bat test --tests "*DespacharInsumo*" --tests "*EntregarInsumo*" --tests "*InsumoApiIT"` → FAIL.
- [ ] **Step 3:** Implementar; corregir los tests de entrega de Task 1 que entregaban desde `ASIGNADO`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(proveedores): despacho previo a la entrega`

### Task 9: Notificaciones FCM y aviso de ETA vencido

**Files:**
- Modify: `proveedores/domain/services/NotificacionInsumoPort.java`, `infrastructure/notification/LoggingNotificacionInsumoAdapter.java`, `AceptarInsumoUseCase`, `DespacharInsumoUseCase`, `EntregarInsumoUseCase`, `RequerimientoInsumoRepository` (+ adaptador)
- Create: `infrastructure/notification/FcmNotificacionInsumoAdapter.java`, `application/usecases/AvisarEtaVencidoUseCase.java`
- Test: `FcmNotificacionInsumoAdapterTest` (patrón de `FcmNotificacionPushAdapter`), `AvisarEtaVencidoUseCaseTest`, ajustes en los tests de Aceptar/Despachar/Entregar

**Interfaces:**
- Produces (puerto, todos sin lanzar): `notificarSolicitud(ProveedorId, OfertaInsumo, RequerimientoInsumo)` (existe), `notificarAceptada(RequerimientoInsumo)`, `notificarDespachada(RequerimientoInsumo)`, `notificarEntregada(RequerimientoInsumo)`, `notificarEtaVencido(RequerimientoInsumo)` — las cuatro últimas van al **técnico** (`requerimiento.getTecnicoId()`: el adaptador resuelve su `usuarioId` con `TecnicoRepository.findByIdAndActivoTrue(TecnicoId)` como hace `FcmNotificacionPushAdapter`); la primera al `usuarioId` del proveedor (`ProveedorRepository.buscarPorId`).
- Reutilizar `FcmSender`, `CanalPush`, `DispositivoPushRepository` (V19, tope 10 dispositivos). Rutas push: proveedor `"/proveedor/insumos"`; técnico `"/tecnico/ejecucion/" + otId`. Cuerpo sin datos personales (solo cantidad de líneas/ETA/estado). `FcmNotificacionInsumoAdapter` con `@ConditionalOnProperty(name="app.push.fcm.enabled", havingValue="true")` y el logging adapter con la condición complementaria que ya usa el par de OT (`LoggingNotificacionPushAdapter`; copiar su condición).
- `List<RequerimientoInsumo> RequerimientoInsumoRepository.buscarEtaVencidos(Instant ahora)` → `ASIGNADO AND eta_minutos IS NOT NULL AND eta_aviso_en IS NULL AND aceptada_en + eta_minutos*interval '1 minute' <= :ahora`; `int AvisarEtaVencidoUseCase.ejecutar()` notifica al técnico y marca `eta_aviso_en` (se invoca desde el programador de Task 6, tras el escalado). Sin sanción ni cambio de estado.
- Si `check-backend-rules` prohíbe importar `ot.infrastructure.notification` desde `proveedores`, mover `FcmSender`/`CanalPush` a `core/shared/infrastructure/notification` como único cambio de ese tipo y re-ejecutar tests de OT.

- [ ] **Step 1: Tests**: adaptador: `envia_a_los_dispositivos_del_usuario`, `un_fallo_del_sender_no_propaga`, `token_invalido_se_elimina`, `sin_dispositivos_no_hace_nada`; use cases: `aceptar_notifica_al_tecnico_tras_persistir`, `fallo_de_notificacion_no_revierte_el_estado`; `AvisarEtaVencido`: `avisa_una_sola_vez`, `no_avisa_si_ya_despachado`.
- [ ] **Step 2:** `.\gradlew.bat test --tests "*NotificacionInsumo*" --tests "*AvisarEtaVencido*"` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASS; luego `.\gradlew.bat build --console=plain` (necesita Docker) y `node scripts/check-backend-rules.mjs` sin subidas.
- [ ] **Step 5: Commit** `feat(proveedores): push de solicitud, aceptacion, despacho, entrega y ETA vencido`

### Task 10: Móvil — ubicación del proveedor y contrato de la API

**Files:**
- Modify: `frontend/src/app/core/models/common.models.ts`, `core/models/backend.dto.ts`, `core/service/backend.mappers.ts`, `core/service/proveedores-api.ts`, `core/service/mock-db.service.ts` (mocks coherentes), `projects/mobile/src/app/pages/solicitudes-proveedor/solicitudes-proveedor.page.ts` + `.html`
- Test: `proveedores-api.spec.ts`, `solicitudes-proveedor.page.spec.ts`

**Interfaces:**
- Consumes: endpoints de Tasks 4, 7, 8.
- Produces (TS): `EstadoRequerimiento` gana `'DESPACHADO'`; `SolicitudInsumoResponse` gana `etaMinutos?, distanciaKm?, aceptadaEn?, despachadaEn?, radioKm?`; `OfertaInsumoResponse` gana `distanciaKm?, etaSugeridoMinutos?`; `ProveedorResponse` gana `latitud?, longitud?`. `ProveedoresApi`: `aceptar(ofertaId: string, etaMinutos: number)`, `despachar(requerimientoId: string): Observable<SolicitudInsumoResponse>` (`POST /insumos/{id}/despachar`), `fijarMiUbicacion(latitud: number, longitud: number): Observable<ProveedorResponse>` (`PUT /proveedores/me/ubicacion`). La página usa `MobileGeolocationService.obtenerPosicion()` (`core/geolocation-native.ts`).
- Comportamiento de la página: si `getMiPerfil()` no trae `latitud/longitud`, banner con botón «Fijar mi ubicación» (texto: «Sin tu ubicación no te llegan solicitudes cercanas.»); al aceptar abre un campo numérico de minutos precargado con `etaSugeridoMinutos` y confirma con «Aceptar y comprometer ETA»; ofertas `ACEPTADA` muestran distancia y ETA, botón «Despachar» (requerimiento `ASIGNADO`) y «Confirmar entrega» (solo `DESPACHADO`); `etiquetaRequerimiento` cubre `DESPACHADO` = «Despachado».

- [ ] **Step 1: Specs que fallan**: `proveedores-api.spec`: `aceptar_envia_etaMinutos_en_el_body`, `despachar_hace_POST_a_despachar`, `fijarMiUbicacion_hace_PUT`; página: `muestra_banner_sin_ubicacion`, `fijar_ubicacion_llama_api_con_la_posicion_del_dispositivo`, `aceptar_precarga_eta_sugerido_y_lo_envia`, `eta_vacio_o_cero_bloquea_el_boton`, `despachar_visible_solo_en_asignado`, `entregar_solo_en_despachado`, `error_409_muestra_copy_humana`.
- [ ] **Step 2:** `cd frontend; npx ng test mobile --watch=false` (o `npm run mobile:test`) → FAIL.
- [ ] **Step 3:** Implementar contrato, mocks y página siguiendo `DESIGN.md` (tokens existentes, estados de carga/error con `ErrorAlertComponent`, `mensajeErrorAccion`).
- [ ] **Step 4:** mismo comando → PASS; `npm run ui:check` sin subidas.
- [ ] **Step 5: Commit** `feat(mobile): proveedor fija ubicacion, acepta con ETA, despacha y entrega`

### Task 11: Móvil — el técnico ve ETA y estado; push del proveedor

**Files:**
- Modify: `projects/mobile/src/app/pages/ejecucion-ot/ejecucion-ot.page.ts` + `.html`, `core/push.ts` solo si hace falta
- Test: `ejecucion-ot.page.spec.ts`, `push` spec existente

**Interfaces:**
- Consumes: `SolicitudInsumoResponse` ampliada (Task 10) vía `GET /api/ot/{id}/insumos`.
- Produce: en la sección Repuestos, por solicitud: estado en español (`Solicitado`, `Asignado`, `Despachado`, `Entregado`, `Sin proveedor`) y, cuando exista, «Llega en ~N min» (`etaMinutos`) y la distancia; `SIN_PROVEEDOR` mantiene el reintento actual.
- Verificar (sin cambio de código si ya funciona): `push.ts` registra el token para cualquier rol, incluido PROVEEDOR, y `RUTA_PERMITIDA` acepta `/proveedor/insumos`; si el modo proveedor no dispara el registro, añadirlo con su spec.

- [ ] **Step 1: Specs que fallan**: `muestra_eta_y_estado_despachado`, `sin_eta_muestra_solo_estado`, `sin_proveedor_conserva_reintento`; push: `acepta_ruta_proveedor_insumos` y `registra_token_en_modo_proveedor`.
- [ ] **Step 2:** `npm run mobile:test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASS; `npm run ui:check`; `npm run mobile:build` (restaurar `MOBILE_API_ORIGIN` si se cambió, AGENTS regla 9).
- [ ] **Step 5: Commit** `feat(mobile): el tecnico ve ETA y estado de sus repuestos`

### Task 12: Verificación de punta a punta y documentación

**Files:**
- Modify: `docs/pendientes.md` (nota de cierre y deuda: re-difusión por ETA vencido, SSE para el proveedor), `docs/backend/TAREAS-BACKEND.md` solo si la guía lo exige
- Test: ninguno nuevo; ejecución completa

- [ ] **Step 1:** `cd backend; node scripts/check-backend-rules.mjs` y `.\gradlew.bat build --console=plain` → verde, sin techos que suban.
- [ ] **Step 2:** `cd frontend; npm run ui:check; npm run mobile:test; npm run mobile:build` → verde.
- [ ] **Step 3:** Con `docker compose up -d db`, `bootRun` y `X-Dev-Usuario`: crear solicitud con técnico demo cerca de un proveedor con ubicación fijada; comprobar oferta → aceptar con ETA → despachar → entregar, y que un segundo proveedor lejano no la recibe a 10 km pero sí tras escalar. Pegar la salida en la entrega.
- [ ] **Step 4:** Entregar con el formato de AGENTS.md (archivos, salida de comandos, Definición de hecho de GUIA-BACKEND §7 y DESIGN §11 marcada, qué no se verificó).
- [ ] **Step 5: Commit** `docs: cierre de proveedores por radio, ETA y despacho`
