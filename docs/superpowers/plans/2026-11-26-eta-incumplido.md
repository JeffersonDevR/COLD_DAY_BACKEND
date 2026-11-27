# ETA incumplido en repuestos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el técnico pueda cambiar de proveedor cuando el ETA prometido vence sin despacho, dejando el incumplimiento registrado para el admin.

**Architecture:** El mismo pedido se reabre con un `UPDATE` condicional (solo `ASIGNADO`, vencido y del técnico) y se vuelve a difundir por radio. La oferta ganadora pasa a `REEMPLAZADA` y se inserta una fila en `incumplimiento_insumo`. El despacho pasa a ser condicional para que la carrera tenga un solo ganador.

**Tech Stack:** Spring Boot 4 / Java 25 / JPA / Flyway / PostGIS; Angular 21 + Ionic 9; Vitest, JUnit 5, Mockito, Testcontainers.

**Spec:** `docs/superpowers/specs/2026-11-26-eta-incumplido-design.md`

## Global Constraints

- Flyway es append-only: solo se agrega `V22__incumplimiento_insumo.sql`.
- Sin sanciones, bloqueos ni contadores que afecten al proveedor.
- Vencido significa `aceptadaEn + etaMinutos <= ahora`, con el `Clock` inyectado. Sin gracia.
- Copy en tuteo, es-CO. Textos exactos: "El proveedor no ha despachado", "Prometió {eta} min · van {n}", "Seguir esperando", "Buscar otro proveedor", "Si nadie más acepta, el pedido queda sin proveedor", "El proveedor ya despachó el pedido", "Todavía no vence el tiempo prometido", "Este pedido ya no es tuyo", "Incumplimientos de ETA", "No hay incumplimientos registrados".
- Móvil para técnico y proveedor; web solo para admin (los cambios web de proveedor se limitan a que compile).
- Verificadores antes y después, sin subir techos: `node backend/scripts/check-backend-rules.mjs`, `npm run ui:check`.
- Los `*IT` necesitan Docker Desktop en marcha. Sin Docker, la tarea que los tiene **no** está terminada: detenerse y avisar.
- Un commit por tarea, `tipo(ámbito): mensaje` en español, con rutas explícitas.

## Review Focus

1. Doble toque en "Buscar otro proveedor": el segundo recibe 409 y no crea otro incumplimiento ni ofertas duplicadas (tarea 2).
2. Proveedor reemplazado que intenta despachar con la pantalla vieja, aun después de que otro aceptó: 409 "Este pedido ya no es tuyo" (tareas 2 y 5).
3. Pedido reabierto más de 15 min después de creado: tiene vigencia nueva y el barrido no lo cierra al instante (tareas 1 y 2).
4. Reloj del teléfono adelantado: el aviso sale antes, el servidor responde 409 y la lista se recarga sin romperse (tarea 5).
5. No hay otro proveedor en el radio: el cambio funciona igual, queda `SOLICITADO` y escala como cualquier pedido (tarea 2).

---

Rutas base: `B` = `backend/src/main/java/com/sena/cold_day/core/modules`, `BT` = lo mismo bajo `src/test`, `F` = `frontend`.

### Task 1: Datos — migración, estado y operaciones condicionales

**Files:**
- Create: `backend/src/main/resources/db/migration/V22__incumplimiento_insumo.sql`
- Create: `B/proveedores/domain/entities/IncumplimientoInsumo.java`, `domain/repository/IncumplimientoInsumoRepository.java`, `infrastructure/persistence/{IncumplimientoInsumoJpaEntity,SpringDataIncumplimientoInsumoRepository}.java`, `infrastructure/repository/IncumplimientoInsumoRepositoryAdapter.java`
- Modify: `OfertaInsumoEstado`, `OfertaInsumoRepository` + adapter + Spring Data, `RequerimientoInsumoRepository` + adapter + Spring Data
- Test: `BT/proveedores/infrastructure/persistence/CambioProveedorRepositoryIT.java`

**Interfaces — Produces:**
- `OfertaInsumoEstado.REEMPLAZADA` (terminal).
- `record IncumplimientoInsumo(UUID id, RequerimientoInsumoId requerimientoId, ProveedorId proveedorId, int etaMinutos, Instant aceptadaEn, Instant reemplazadoEn)`
- `IncumplimientoInsumoRepository`: `void guardar(IncumplimientoInsumo)`, `List<IncumplimientoInsumo> recientes()` (máx. 200, `reemplazadoEn` descendente).
- `RequerimientoInsumoRepository`: `int reabrirSiEtaVencido(RequerimientoInsumoId id, UUID tecnicoId, Instant ahora, Instant expiraEn, double radioKm, Instant ventanaExpiraEn)`; `int despacharSiAsignado(RequerimientoInsumoId id, ProveedorId proveedorId, Instant ahora)`.
- `OfertaInsumoRepository`: `int reemplazarAceptada(RequerimientoInsumoId id, ProveedorId proveedorId, Instant ahora)`; `boolean fueReemplazado(RequerimientoInsumoId id, ProveedorId proveedorId)`.

**Reglas que la firma no dice:**
- `reabrirSiEtaVencido` es nativo (usa `interval`, como `buscarEtaVencidos`): `WHERE id AND tecnico_id AND estado='ASIGNADO' AND aceptada_en + (eta_minutos * interval '1 minute') <= :ahora`; pone `SOLICITADO`, la vigencia, radio y ventana nuevas y `NULL` en `eta_minutos, distancia_km, aceptada_en, eta_aviso_en`.
- `despacharSiAsignado` es **una sola sentencia**: `estado='ASIGNADO'` y `EXISTS` una oferta `ACEPTADA` de ese proveedor para ese pedido.
- `proveedoresOfertados` pasa a devolver solo quienes tienen oferta `PENDIENTE`, `ACEPTADA`, `RECHAZADO` o `REEMPLAZADA` (actualizar su Javadoc).
- La migración recrea el check de `oferta_insumo.estado` (`oferta_insumo_estado_check`) con `REEMPLAZADA` y crea `incumplimiento_insumo` con FKs a `requerimiento_insumo` y `proveedor` e índice `(proveedor_id)`.

- [ ] **Step 1:** Escribir `CambioProveedorRepositoryIT` (mismo andamiaje que `RequerimientoInsumoRepositoryTest`):
  - `noReabreAntesDeVencer`: aceptado hace 29 min con ETA 30 → `0`, sigue `ASIGNADO`.
  - `reabreVencidoConVigenciaNueva`: hace 30 min con ETA 30 → `1`; `SOLICITADO`, `expiraEn` nuevo, los cuatro campos en `null`.
  - `noReabreDeOtroTecnicoNiDespachado` → `0`.
  - `noDespachaConOfertaReemplazada`: pedido `ASIGNADO` a B, `despacharSiAsignado(.., A, ..)` → `0`.
  - `vuelveAOfrecerACanceladosPeroNoAReemplazado`: `proveedoresOfertados` contiene reemplazado y rechazado, no el cancelado.
  - `guardaYListaIncumplimientosRecientesPrimero`.
- [ ] **Step 2:** `cd backend; .\gradlew.bat test --tests "*CambioProveedorRepositoryIT" --console=plain` → falla al compilar.
- [ ] **Step 3:** Implementar migración, entidad, puertos y adaptadores.
- [ ] **Step 4:** Repetir el comando → PASS. `node scripts/check-backend-rules.mjs` → `backend-rules: OK`.
- [ ] **Step 5:** Commit `feat(proveedores): datos para reabrir un pedido y registrar el incumplimiento`.

### Task 2: Casos de uso — cambiar de proveedor y despacho condicional

**Files:**
- Create: `B/proveedores/application/usecases/CambiarProveedorInsumoUseCase.java`, `B/ot/application/usecases/CambiarProveedorInsumoOtUseCase.java`, `B/proveedores/domain/exception/{CambioProveedorNoPermitidoException,PedidoReemplazadoException}.java`
- Modify: `DespacharInsumoUseCase`, `NotificacionInsumoPort`, ambos adaptadores de notificación
- Test: `BT/proveedores/application/usecases/{CambiarProveedorInsumoUseCaseTest,DespacharInsumoUseCaseTest}.java`

**Interfaces — Consumes:** tarea 1; `SolicitarInsumoUseCase.ofrecer(req, radioKm, ahora)` y `ventanaMs()`.

**Produces:**
- `CambiarProveedorInsumoUseCase.cambiar(RequerimientoInsumoId id, UUID tecnicoId): RequerimientoInsumo`
- `CambiarProveedorInsumoOtUseCase.cambiar(UsuarioId, RequerimientoInsumoId): RequerimientoInsumo` — resuelve el técnico (como `ListarInsumosOtUseCase`) y delega; así `proveedores/application` no importa `tecnicos`.
- `NotificacionInsumoPort.notificarReemplazado(ProveedorId, RequerimientoInsumo)`; FCM: título "Pedido reasignado", cuerpo "El técnico buscó otro proveedor porque pasó el tiempo prometido. Este pedido ya no es tuyo.", ruta `/proveedor/insumos`.

**Orden dentro de la transacción:** leer pedido (inexistente o de otro técnico → `RequerimientoInsumoNoEncontradoException`) → leer la oferta `ACEPTADA` → `reabrirSiEtaVencido` (0 → `CambioProveedorNoPermitidoException`, con "El proveedor ya despachó el pedido" si está `DESPACHADO`/`ENTREGADO`, si no "Todavía no vence el tiempo prometido") → `reemplazarAceptada` → `guardar` incumplimiento con el ETA y `aceptadaEn` leídos **antes** de reabrir → releer → `ofrecer` → push best effort. La vigencia sale de `app.insumos.vigencia-ms` y el radio de `app.insumos.radio-inicial-km`.

**Despacho:** si `fueReemplazado` → `PedidoReemplazadoException` ("Este pedido ya no es tuyo"), antes del chequeo de elegibilidad por oferta. Sustituir `save` por `despacharSiAsignado`; con `0`, releer: reemplazado → `PedidoReemplazadoException`; otro caso → `TransicionRequerimientoInvalidaException`.

- [ ] **Step 1:** Tests con Mockito (reloj fijo, estilo `DespacharInsumoUseCaseTest`):
  - `reabreReemplazaRegistraYVuelveAOfrecer` (verifica `InOrder`, `expiraEn = ahora + 900 s`, radio 10).
  - `siNoCambiaFilasNoRegistraNiOfrece` (cubre el doble toque) con los dos mensajes.
  - `otroTecnicoRecibeNoEncontrado`.
  - `sinProveedoresEnElRadioElCambioFunciona`.
  - `unPushCaidoNoRevierteElCambio`.
  - En despacho: `elReemplazadoNoDespacha` y `siElPedidoCambioEntreLeerYEscribirDaConflicto`; adaptar los existentes que verifican `save`, porque la tarea cambia ese comportamiento.
- [ ] **Step 2:** `.\gradlew.bat test --tests "*CambiarProveedorInsumoUseCaseTest" --tests "*DespacharInsumoUseCaseTest" --console=plain` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir → PASS; verificador de backend OK.
- [ ] **Step 5:** Commit `feat(proveedores): el tecnico cambia de proveedor cuando vence el ETA`.

### Task 3: API

**Files:**
- Modify: `InsumoController`, `InsumoControllerAdvice`, `ProveedorController`
- Create: `B/proveedores/application/usecases/ListarIncumplimientosUseCase.java`, `infrastructure/api/responses/IncumplimientoApiResponse.java`
- Test: `BT/proveedores/infrastructure/api/controllers/CambioProveedorApiIT.java`

**Produces:**
- `POST /api/insumos/{id}/cambiar-proveedor` (`hasRole('TECNICO')`) → `SolicitudInsumoApiResponse`; las dos excepciones nuevas → 409 con su mensaje.
- `GET /api/proveedores/incumplimientos` (`hasRole('ADMINISTRADOR')`) → `[{id, proveedorId, razonSocial, requerimientoId, etaMinutos, aceptadaEn, reemplazadoEn}]`.

- [ ] **Step 1:** IT con el andamiaje de `InsumoApiIT` (reloj fijo): 409 antes de vencer; 200 vencido y el anterior deja de verlo en `/proveedores/me/solicitudes`; 404 otro técnico; 403 proveedor en `cambiar-proveedor`; 409 "Este pedido ya no es tuyo" al despachar; el admin lista el incumplimiento y un técnico recibe 403. `carreraDespacharContraCambiar`: dos hilos (estilo `RequerimientoInsumoConcurrenteIT`), exactamente uno gana.
- [ ] **Step 2:** `.\gradlew.bat test --tests "*CambioProveedorApiIT" --console=plain` → FAIL (404 en las rutas).
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir → PASS. Luego `.\gradlew.bat build --console=plain` → BUILD SUCCESSFUL; verificador OK.
- [ ] **Step 5:** Commit `feat(proveedores): endpoints para cambiar de proveedor y listar incumplimientos`.

### Task 4: Core del frontend

**Files:**
- Modify: `F/src/app/core/models/{common.models,backend.dto}.ts`, `core/service/{tecnicos-api,proveedores-api,backend.mappers,mock-db.service}.ts`
- Modify (solo para compilar): los `switch` sobre `OfertaInsumoEstado` en las dos pantallas de solicitudes del proveedor ("Reemplazada", tono `cerrada`)
- Test: `core/service/{tecnicos-api,proveedores-api}.spec.ts` (crear si no existen)

**Produces:**
- `OfertaInsumoEstado` incluye `'REEMPLAZADA'`.
- `TecnicosApi.cambiarProveedorInsumo(requerimientoId: string): Observable<SolicitudInsumoResponse>`
- `ProveedoresApi.getIncumplimientos(): Observable<IncumplimientoInsumo[]>`; `interface IncumplimientoInsumo { id; proveedorId; razonSocial; requerimientoId; etaMinutos: number; aceptadaEn: string; reemplazadoEn: string }`
- Mock: cambiar deja el requerimiento `SOLICITADO` sin ETA; incumplimientos devuelve `[]` más los cambios hechos en memoria.

- [ ] **Step 1:** Specs HTTP: método y URL exactos de las dos llamadas, y el mapeo de la respuesta.
- [ ] **Step 2:** `npx ng test app --watch=false` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npx ng test app --watch=false` y `npm run mobile:build` → PASS.
- [ ] **Step 5:** Commit `feat(frontend): contratos para cambiar de proveedor e incumplimientos`.

### Task 5: Móvil — aviso del técnico y mensaje del proveedor

**Files:**
- Modify: `F/projects/mobile/src/app/pages/ejecucion-ot/ejecucion-ot.page.{ts,html,spec.ts}`, `pages/solicitudes-proveedor/solicitudes-proveedor.page.{ts,spec.ts}`

**Interfaces — Consumes:** `TecnicosApi.cambiarProveedorInsumo`.

**Comportamiento:**
- Señal `ahora` que se actualiza cada 30 s; en el mismo ciclo se recargan los pedidos mientras haya alguno `SOLICITADO`, `ASIGNADO` o `DESPACHADO` (con `pollVisibleTab`, no depende del respaldo de SSE).
- Aviso en la tarjeta del pedido (`data-testid="eta-vencido-{id}"`) si `ASIGNADO` y vencido. `eta-esperar-{id}` pliega el texto y deja `eta-buscar-{id}`.
- `eta-buscar-{id}` muestra la confirmación en la misma tarjeta (`eta-confirmar-cambio-{id}`), deshabilitada mientras hay una petición en curso.
- Éxito: toast y recarga. 409: toast con el mensaje del servidor y recarga.
- Proveedor: 409 al despachar muestra "Este pedido ya no es tuyo" si ese es el mensaje del servidor, si no "Este pedido ya fue despachado."; en ambos casos recarga.
- Estilos: reutilizar `cd-alerta--aviso`, sin clases nuevas de color.

- [ ] **Step 1:** Specs: sin aviso antes de vencer ni en `DESPACHADO`; "Prometió 30 min · van 38"; "Seguir esperando" no llama a la API; confirmar llama una sola vez con `req1`; el 409 muestra el mensaje y vuelve a llamar `getInsumosOt`; el aviso aparece al avanzar el reloj falso sin recargar la pantalla; en proveedor, los dos mensajes del 409.
- [ ] **Step 2:** `npx ng test mobile --watch=false` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir → PASS; `npm run ui:check` y `npm run mobile:build` OK.
- [ ] **Step 5:** Commit `feat(mobile): el tecnico decide cuando el proveedor incumple el ETA`.

### Task 6: Web admin — incumplimientos

**Files:**
- Modify: `F/src/app/pages/proveedores-admin-page/proveedores-admin-page.{ts,html,spec.ts}`; `docs/superpowers/plans/2026-11-25-backlog-movil-priorizado.md` (P2.1 hecho; la fase B de documentos pasa a `V23`)

**Interfaces — Consumes:** `ProveedoresApi.getIncumplimientos`.

**Comportamiento:** sección "Incumplimientos de ETA" bajo la bandeja: total por proveedor, y filas con proveedor, minutos prometidos, aceptación y reemplazo. Con 200 filas, nota "Se muestran los 200 más recientes". Carga y error propios (`app-carga-error`), sin bloquear la validación. Sin `dark:` ni `text-slate-500` nuevos.

- [ ] **Step 1:** Specs: filas y total por proveedor; "No hay incumplimientos registrados"; el error de esta sección no oculta la bandeja. Agregar el stub `getIncumplimientos` al `setup` existente.
- [ ] **Step 2:** `npx ng test app --watch=false` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir → PASS; `npm run ui:check` OK.
- [ ] **Step 5:** Commit `feat(admin): incumplimientos de ETA por proveedor`.
