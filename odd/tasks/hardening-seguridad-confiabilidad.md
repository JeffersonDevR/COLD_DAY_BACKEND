# Feature: hardening-seguridad-confiabilidad

## Objective
Cerrar los hallazgos de la auditoría read-only del 2026-10-19 (seguridad, concurrencia, configuración, frontend e infraestructura) en oleadas ordenadas por riesgo real, de modo que el sistema no pueda arrancar ni operar en un estado inseguro.

## Problem
Auditoría completa del repo (3 auditores en paralelo, evidencia `file:line`, memoria Engram `audit/2026-10-19-seguridad-y-calidad`). El núcleo de autorización está bien: **no hay IDOR**, no hay SQLi, JWT/bcrypt/recuperación de contraseña están bien implementados. Las fallas están en otro lugar:

1. **La configuración permite desactivar toda la seguridad.** El perfil por defecto es `dev` (bypass de auth + secreto JWT público) y el guard de prod solo reconoce el string `"prod"`.
2. **La capa de persistencia anula el control de concurrencia.** El `save` re-lee y sobrescribe todas las columnas desde un agregado en memoria, mientras los bulk updates con `clearAutomatically` evictan las entidades: el `@Version` nunca frena nada. Hay pérdida de actualización silenciosa y un técnico puede quedar en dos OTs.
3. **Abuso:** rate limit bypaseable por header y sin dimensión de cuenta, contraseñas sin política, enumeración de cuentas, JWT no revocable.
4. **Frontend:** datos ficticios en un build real, primitivas de "login como admin" en el bundle, una API key real subida a Sonar, builds verdes que fallan en runtime.
5. **Operación:** sin paginación, barridos sin aislamiento, índices y constraints faltantes, CI sin escaneo de dependencias.

## Baseline (estado verificado del repo)
- `main` = `2c2bf0a`, sincronizado con `origin/main`; `ARQUITECTURA.md` tiene cambios sin commitear.
- Backend: Spring Boot **4.1.1** / Java **25**, Gradle, PostgreSQL/PostGIS, Flyway (`V1`–`V14`), Testcontainers.
- Frontend: Angular (SPA, sin SSR), Vitest, 70 specs versionados.
- Tests backend: `./gradlew test` (Testcontainers + PostGIS real). Frontend: `npm test -- --watch=false`.
- TDD: `strict_tdd: false` → verificación funcional estándar, no ciclo RED/GREEN obligatorio.

## Scope
Todo lo listado en las oleadas W0–W9 de este documento.

## Out of scope
- Reescribir la arquitectura hexagonal: está bien y no es la causa de nada.
- Migrar auth a cookies httpOnly (requiere cambio de contrato de API; queda como follow-up con decisión de producto).
- Implementar push real (`LoggingNotificacionPushAdapter`) o chat real.
- Multi-réplica real: si el deploy es de una sola instancia (Railway/Render free), el registry SSE en memoria es aceptable; el plan deja el guard, no el broker.
- Cualquier cambio de comportamiento de negocio no pedido (matriz de cancelación, tarifas, reglas de negocio).

## Constraints
- **No tocar** lo verificado como correcto: autorización por use case, parametrización de queries, bcrypt cost 12, recuperación de contraseña, tickets SSE de un solo uso, CORS con `allowCredentials(false)`, actuator `health/info`.
- Cambios mínimos (ponytail): sin dependencias nuevas salvo ShedLock, y solo si W4 lo justifica; preferir SQL/JPA nativo.
- Migraciones Flyway **aditivas** (`V15+`); nunca editar `V1`–`V14` (la CI valida append-only).
- Un PR ≤ ~400 líneas autoradas. Si una oleada excede, se parte.
- Cada tarea cierra con verificación observada, no declarada.
- `strict_tdd: false`; runners exactos en cada tarea.

## Authorized scope
El usuario pidió "un plan en un .md para aplicarlo después" (2026-10-19). Este documento es el plan; **la implementación no está autorizada todavía**. Ninguna tarea de acá se ejecuta sin una orden explícita.

## Orden de ataque (por qué este orden)
```
W0 verificación de drift   ← bloquea W5/W9 (índices/constraints)
W1 config fail-closed      ← 2 líneas, elimina la clase de riesgo más grande
W2 bundle frontend         ← datos ficticios + admin desde consola + key filtrada
W3 build/deploy            ← sin esto prod no arranca o 404ea
W4 concurrencia OT/técnico ← el bug de negocio más caro
W5 barridos                ← depende de W4 (mismo modelo de locking)
W6 paginación/N+1          ← capacidad
W7 abuso de auth           ← rate limit, política de password, revocación
W8 SSE                     ← hardening
W9 schema                  ← índices/CHECKs (depende de W0)
W10 frontend robustez
W11 dominio/errores/audit
W12 docs e higiene
```

## Acceptance criteria (global)
- [ ] `./gradlew test` verde y sin tests nuevos flaky (2 corridas consecutivas).
- [ ] `npm test -- --watch=false` verde y `npx tsc -p tsconfig.app.json --noEmit` + `tsconfig.spec.json` exit 0.
- [ ] Arrancar sin `SPRING_PROFILES_ACTIVE` **falla** (fail-closed) y el mensaje nombra la variable faltante.
- [ ] Arrancar con `prod` y el secreto dev **falla**.
- [ ] `render.yaml` contiene todas las variables que `application-prod.properties` exige sin default.
- [ ] Ninguna API key real en archivos analizados por Sonar ni en el bundle servido.
- [ ] Existe un test que reproduce la pérdida de actualización de W4 y falla antes del fix.
- [ ] Existe un test que demuestra que un técnico no puede tener dos OTs activas.

---

## W0 — Verificación de drift de base de datos (BLOQUEANTE)

**Por qué primero:** el schema de producción fue *baselined* (`baseline-on-migrate=true`, `baseline-version=1`), así que `V1` nunca se ejecutó allí. Todas las conclusiones sobre índices/constraints se derivan de leer las migraciones contra las entidades, no de una base real. Sin esto, W9 puede crear índices que ya existen (o faltar constraints que ya están).

### T0.1 (parent, read-only): comparar schema real vs repo
- Conectar a la base de producción (o a un dump restaurado) y extraer:
  - `\d+ ot`, `\d+ tecnico`, `\d+ disputa`, `\d+ oferta_ot`, `\d+ requerimiento_insumo*`
  - `pg_indexes`, `information_schema.table_constraints`, `pg_constraint`
  - `SELECT * FROM flyway_schema_history ORDER BY installed_rank;`
- Comparar contra `V1`–`V14` + las entidades.
- **Entregable:** tabla de drift en este documento (tabla real / columna faltante / constraint faltante).
- **Verificación:** el conteo de columnas de `ot` coincide con `OtJpaEntity`; `flyway_schema_history` sin `failed`.

### T0.2 (parent): confirmar topología de deploy real
- Determinar cuántas réplicas corren (Render free = 1; Railway = ?). Esto define la severidad de W5/W8.
- Confirmar qué variables están realmente seteadas (`CORS_ALLOWED_ORIGINS`, `MAIL_*`, `APP_SEED_ENABLED`).
- **Salida:** anotar en `Constraints` de cada oleada afectada.

---

## W1 — Configuración fail-closed (CRÍTICO, PR chico)

**Cierra:** C1, C2, C3 + seed password + reset URL.

### T1.1 — Eliminar el perfil por defecto
- `backend/src/main/resources/application.properties:11` → borrar `spring.profiles.active=dev`.
- Efecto buscado: sin perfil no hay `app.jwt.secret` → `JwtProperties` falla → **fail-closed**.
- **Verificación:** `./gradlew bootRun` sin variables falla con un mensaje que nombra la propiedad; el test `BypassDesactivadoEnProdTest` sigue verde.
- **Riesgo:** cualquier script local que dependía del perfil dev. Mitigación: documentar `--spring.profiles.active=dev` en `.env.example` y en el README.

### T1.2 — Guard real contra el secreto de desarrollo
- `JwtProperties.java:19` ya declara `DEV_DEFAULT_SECRET` y **nunca se usa**. Usarlo:
  ```java
  if (DEV_DEFAULT_SECRET.equals(secret) && !perfilEsDev) {
      throw new IllegalStateException("JWT_SECRET es el valor de desarrollo; configura uno real");
  }
  ```
- `application-dev.properties:27` mantiene el default (es dev); `.env.example:8` deja de publicar el literal (`JWT_SECRET=PEGA_AQUI_UN_SECRETO_ALEATORIO_DE_32_BYTES`).
- **Verificación:** test nuevo `JwtPropertiesTest`: dev + default ⇒ OK; prod + default ⇒ excepción; prod + secreto real ⇒ OK.

### T1.3 — Completar `render.yaml`
- Agregar `CORS_ALLOWED_ORIGINS` con `sync: false`.
- Agregar `MAIL_RESET_URL_BASE` con `sync: false`.
- Agregar `APP_SEED_DEMO_PASSWORD` con `sync: false` **solo si** `APP_SEED_ENABLED` puede ser true; en caso contrario documentar que el seed se mantiene en false.
- **Verificación:** un script de chequeo (o test) que compare las claves `${...}` sin default de `application-prod.properties` contra las `key:` de `render.yaml`; debe dar vacío.

### T1.4 — Seed y password de demo
- `application-prod.properties`: `app.seed.demo-password=${APP_SEED_DEMO_PASSWORD}` (sin default) y rechazo explícito del literal `demo1234` cuando `app.seed.enabled=true`.
- `DevDataSeeder.java:47`: `matchIfMissing = false` (opt-in real).
- **Verificación:** `DevDataSeederTest` ampliado; arranque prod con `APP_SEED_ENABLED=true` sin password ⇒ falla.

### T1.5 — Mail no puede fingir éxito
- `LoggingNotificadorRecuperacion`: si no hay transporte configurado, el endpoint de recuperación devuelve 503 en vez de 200.
- **Verificación:** test de `RecuperarContrasenaUseCase` con `app.mail.enabled=false` ⇒ 503; con transporte ⇒ 200.

**Presupuesto:** ~80 líneas. **Un PR.**

---

## W2 — Seguridad del bundle frontend

**Cierra:** C5 (chat ficticio), H-falso-admin, H-sonar-key.

### T2.1 — Borrar el chat ficticio
- `frontend/src/app/pages/diagnostico-ot-page/diagnostico-ot-page.ts:62-66` (seed) y `:180-185` (auto-reply con `setTimeout`).
- Ocultar el panel de chat hasta que exista API real (no hay endpoint en `ot-api.ts`).
- **Verificación:** spec que asegura que el panel no se renderiza; `grep chatMensajes` vacío.

### T2.2 — Eliminar la escalada de privilegios del cliente
- `frontend/src/app/core/service/auth.service.ts:178-228` → borrar `switchDemoRole()`.
- `:115-126` → quitar el fallback a `createMockJwt()` en `setCurrentUser()`.
- `frontend/src/app/core/service/token-storage.service.ts:77-93` → borrar `createMockJwt()` si queda sin uso.
- Mover el mock DB a un árbol que no se empaquete en producción (o borrarlo si `useMocks=true` ya no se usa en ningún flujo real).
- **Verificación:** `grep -r "switchDemoRole\|createMockJwt" frontend/src` vacío; build de producción sin `mock-db` en el chunk inicial (comparar tamaños antes/después).

### T2.3 — Corregir la exclusión de Sonar y rotar la key
- `frontend/sonar-project.properties:9` → `src/app/core/environment/maps-key.ts`.
- `:13` → mismo path.
- **Rotar la API key de Google Maps en la consola de Google** (la actual estuvo expuesta en el servidor Sonar).
- **Verificación:** correr `npm run sonar` y confirmar en el log del scanner que el archivo **no** aparece en "files to be analyzed".

### T2.4 — Guard de rutas de cliente
- `frontend/src/app/app.routes.ts:57-86`: agregar `roleGuard(['CLIENTE','TECNICO','ADMINISTRADOR'])` a las cinco rutas `cliente/ot/*` y `cliente/equipos`.
- **Verificación:** spec de `roleGuard` cubriendo PROVEEDOR/CONTABLE rechazado.

**Presupuesto:** ~120 líneas. **Un PR.**

---

## W3 — Build y despliegue que no mienten

**Cierra:** H9 (API_ORIGIN silencioso), headers de seguridad, CI sin escaneo, acciones mutables.

### T3.1 — `API_ORIGIN` obligatorio en producción
- `frontend/scripts/generate-api-origin.mjs:87-105`: si `API_ORIGIN` está vacío y (`NODE_ENV==='production'` o `CI`), salir con código ≠ 0 y mensaje claro.
- Mantener el comportamiento permisivo solo para `ng serve` local.
- **Verificación:** `npm run build` sin `API_ORIGIN` falla; con la variable, genera `api-origin.ts` correcto.

### T3.2 — Headers de seguridad en Vercel
- `frontend/vercel.json`: agregar bloque `headers` con `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS y una CSP que permita solo el origen de la API configurado.
- **Verificación:** `npx serve dist` + curl de headers; CSP sin `unsafe-eval`.

### T3.3 — CI con gates reales
- `frontend-ci.yml`: `npm audit --audit-level=high`, `npx eslint src --max-warnings 0`, `upload-artifact` de `coverage/`.
- `backend-ci.yml`: `gradle dependency-check` o `actions/dependency-review-action` en PRs.
- `timeout-minutes` en todos los jobs (30 backend, 15 frontend).
- Pinnear acciones a SHA (con comentario `# v4.x.x`).
- **Verificación:** un PR de prueba con una dependencia vulnerable simulada falla el job.

### T3.4 — Proxy de desarrollo completo
- `frontend/proxy.conf.json` y `proxy.local.json`: reemplazar los nueve prefijos por un catch-all `"/api"` → `http://localhost:8090`.
- **Verificación:** `npm start` + abrir el portal de proveedores y el SSE; ambos llegan al backend.

**Presupuesto:** ~120 líneas. **Un PR.** (T3.1 es el que evita el outage silencioso.)

---

## W4 — Concurrencia de la OT (el bug de negocio más caro)

**Cierra:** C4 (pérdida de actualización), H1 (técnico en dos OTs), H2 (bump de versión), H6 (disputa duplicada).

### T4.1 — Reproducir el lost-update (primero el test)
- Test de integración nuevo `BarridosVsTransicionManualIT`:
  1. OT en `BUSCANDO_TECNICO` con ventana vencida.
  2. Hilo A ejecuta `EscalarRadioUseCase.ejecutar()`.
  3. Hilo B (intercalado con barrera) ejecuta `AceptarOfertaUseCase`.
  4. Assert: la OT queda `ASIGNADA` con `tecnico_id` no nulo **o** el barrido falla con conflicto; nunca `BUSCANDO_TECNICO` con técnico asignado.
- Este test **debe fallar** antes del fix (evidencia RED).
- **Verificación:** correrlo en la rama actual y capturar el fallo.

### T4.2 — `save` sin re-lectura + versión esperada
`OtRepositoryAdapter.save:65-89`:
- Dejar de hacer `findById(...).map(applyFromDomain)`.
- Opción A (mínima, recomendada): cargar con `entityManager.find(OtJpaEntity.class, id, LockModeType.OPTIMISTIC)` y **assert** que `entity.getVersion()` es la que el agregado trae; si no coincide, lanzar `OptimisticLockingFailureException` (ya mapeada a 409 en `GlobalControllerAdvice:64-71`).
- Opción B: agregar `version` al agregado `Ot` y hacer un UPDATE condicional `where id=? and version=?` que devuelva 0 filas en mismatch.
- **Decisión:** el writer elige la más chica y lo justifica.
- **Verificación:** T4.1 pasa; suite completa verde.

### T4.3 — Quitar `clearAutomatically` de los bulk de ofertas
- `SpringDataOfertaOtRepository.java:27,37` → `clearAutomatically = false` (o quitar la bandera).
- Justificación: esos UPDATE tocan `oferta_ot`, no `ot`; evictar `ot` es lo que anula el lock.
- Si algún test depende del clear para ver el cambio, reemplazar por `flushAutomatically` + recarga explícita en el caso que lo necesite.
- **Verificación:** T4.1; `AceptacionConcurrenteIT` y `PagarVisitaConcurrenteIT` verdes.

### T4.4 — `asignarSiDisponible` debe bumpear versión
- `SpringDataOtRepository.java:33-41` → agregar `o.version = o.version + 1` al JPQL.
- **Verificación:** test que: carga OT en vN → asignación bulk → intento de save con vN ⇒ `OptimisticLockingFailureException`.

### T4.5 — Locking del técnico
- Migración `V15__tecnico_version.sql`: `ALTER TABLE tecnico ADD COLUMN version bigint NOT NULL DEFAULT 0;`
- `TecnicoJpaEntity`: `@Version` + campo.
- `TecnicoRepositoryAdapter.save`: mismo patrón que T4.2 (no re-leer y sobrescribir).
- `AceptarOfertaUseCase:117-118`: convertir la aceptación en UPDATE condicional `where id=? and estado_operativo='DISPONIBLE'` y verificar filas afectadas (0 ⇒ `TecnicoAsignadoException`).
- **Verificación:** test `TecnicoNoPuedeTenerDosOtsIT` con dos aceptaciones concurrentes; exactamente una gana.

### T4.6 — Disputa única por OT
- Migración `V16__disputa_unica_abierta.sql`:
  `CREATE UNIQUE INDEX idx_disputa_ot_abierta ON disputa (ot_id) WHERE estado = 'ABIERTA';`
- `@Version` en `DisputaJpaEntity` + columna.
- Mapear `DataIntegrityViolationException` a 409 con mensaje humano.
- **Verificación:** test de doble `abrirDisputa` concurrente ⇒ una 201, una 409; nunca dos ABIERTAS.

**Presupuesto:** ~350 líneas (test + fix + migraciones). **Un PR** (o dos si el test se va aparte).

---

## W5 — Barridos programados

**Cierra:** H3 (solapamiento sin aislamiento), H4 (limpieza O(N) y huérfanas imposibles), M6 (propiedades no declaradas).

### T5.1 — Aislamiento por ítem
- `EscalarRadioUseCase.ejecutar` y `LimpiarOrdenesHuerfanasUseCase.ejecutar`: extraer el cuerpo del loop a un método `@Transactional(propagation = REQUIRES_NEW)` y capturar `Exception` por ítem con log + contador.
- Nunca dejar que un conflicto aborte el lote.
- **Verificación:** test que inyecta una OT que falla y verifica que las demás se procesan.

### T5.2 — Guard de instancia única
- Si W0.2 confirma una sola réplica: agregar un `@SchedulerLock`-equivalente mínimo (advisory lock de Postgres) **o** un flag `app.scheduling.enabled` documentado.
- Si hay más de una réplica: ShedLock + tabla `shedlock` (migración aditiva).
- **Verificación:** dos instancias en Testcontainers no procesan la misma OT dos veces (o el lock se rechaza).

### T5.3 — Limpieza de huérfanas acotada y completa
- `LimpiarOrdenesHuerfanasUseCase:46-74`: reemplazar `listarTodas()` por una query acotada (`estado IN (...) AND (tecnico_id IS NULL OR NOT EXISTS (SELECT 1 FROM tecnico t WHERE t.id = ot.tecnico_id AND t.activo))`).
- Resolver `EN_REPARACION`: o se agrega la arista a `CANCELADA` con motivo `LIMPIEZA_SISTEMA`, o se saca del set y se documenta que no se limpia.
- **Decisión de producto requerida** para el caso `EN_REPARACION` → **preguntar al usuario antes de implementar**.
- **Verificación:** test con 1 huérfana + 1 válida; solo la huérfana se cancela, en una sola query.

### T5.4 — Declarar las propiedades faltantes
- `application.properties`: `app.tecnicos.reconciliacion-ms` y `app.ot.limpieza-huerfanos-ms` con default y override por env.
- `build.gradle` test task: empujar ambos a `3600000` (igual que los otros barridos).
- **Verificación:** grep sin resultados de propiedades usadas y no declaradas; suite estable en 2 corridas.

**Presupuesto:** ~200 líneas. **Un PR.**

---

## W6 — Capacidad de lectura (paginación y N+1)

**Cierra:** H5 (sin paginación), M1 (N+1).

### T6.1 — Paginación en listados admin
- `OtRepositoryAdapter.listarTodas:130-132`, `LiquidacionRepositoryAdapter:80-81`, `DisputaRepositoryAdapter:62-63`, `ProveedorRepositoryAdapter:40-41`.
- Agregar `Pageable` a los puertos o, mínimo, `limit`/`offset` con default 50.
- `AdminController:62,76,101` expone `page`/`size` y devuelve metadata (`total`).
- **Verificación:** `GET /api/admin/ots?page=0&size=50` no carga más de 50 filas (medir con Hibernate statistics o log de SQL).

### T6.2 — Batch en resolución de nombres
- `NombresOtResolver:49-71` → resolver clientes/técnicos con `findAllByUsuarioIdIn` / `findAllById` en dos queries, no 2N.
- **Verificación:** test con 20 OTs de 20 clientes distintos ⇒ ≤ 4 queries (contar con un `QueryCounter` o log).

### T6.3 — Reemplazar lookups por lote en disputas/liquidaciones
- `GestionarDisputaUseCase:129-130` y `VerificarComprobanteUseCase:115-117` → usar `buscarPorIds` (ya existe en `OtRepositoryAdapter:97-108`).
- **Verificación:** test con 10 disputas ⇒ 1 query de OTs, no 10.

**Presupuesto:** ~250 líneas. **Un PR** (o dos: paginación / N+1).

---

## W7 — Abuso de autenticación y datos personales

**Cierra:** H7 (XFF), M1/M2 (rate limit), M3 (password policy), H5 (enumeración), M4 (JWT revocable), M5 (GPS de técnicos).

### T7.1 — Rate limit por cuenta y confianza de proxy
- `RateLimitFilter:105`: segunda clave `correo` para login/recuperación, con el mismo Caffeine.
- `application-prod.properties`: `server.tomcat.remoteip.internal-proxies` restringido al CIDR del proxy, **o** `FORWARD_HEADERS_STRATEGY=NONE` si no hay proxy.
- `RUTAS_LIMITADAS` (`RateLimitFilter:69-73`): agregar `/api/tecnicos`, `/api/clientes`, `/api/proveedores`.
- **Verificación:** test que rota `X-Forwarded-For` y sigue bloqueado por cuenta; test de los tres endpoints públicos limitados.

### T7.2 — Política de contraseña
- `@Size(min = 8, max = 72)` en `CredencialesApiRequest:10`, `RestablecerContrasenaApiRequest:7`, `ClienteOnboardingApiRequest:20`, `TecnicoApiRequest:17`, `ProveedorApiRequest:28`.
- Validación equivalente en el agregado `Usuario:60` (defensa en profundidad).
- **Verificación:** tests de 400 para contraseñas cortas/largas.

### T7.3 — Cerrar enumeración y oráculo de timing
- `AutenticarUsuarioUseCase:35-38`: cuando el correo no existe, ejecutar un bcrypt dummy contra un hash fijo (mismo costo).
- Registro (`RegistrarUsuarioUseCase`, `RegistrarClienteUseCase`, `RegistrarTecnicoUseCase`, `RegistrarProveedorUseCase`): no devolver 409 que confirme existencia; responder uniforme y notificar por correo.
- **Decisión de producto requerida** (el 409 actual es UX útil) → **preguntar antes**.
- **Verificación:** medir tiempos de login existente vs inexistente (diferencia < 10%); test de registro duplicado con respuesta uniforme.

### T7.4 — Revocación de JWT
- `JwtAuthenticationFilter:104-108`: `.orElse(true)` → `.orElse(false)`.
- `EliminarTecnicoUseCase:20-25`: bumpear `tokenVersion` al desactivar.
- `AutenticarUsuarioUseCase`: rechazar `!usuario.isActivo()`.
- **Verificación:** test con token de usuario eliminado ⇒ 401; técnico desactivado ⇒ token viejo rechazado.

### T7.5 — GPS de técnicos
- `TecnicoCercanoApiResponse:16-17`: quitar `latitud`/`longitud` o redondear a ~100 m; el radar no los necesita (ya tiene `distanciaKm`).
- **Verificación:** test de contrato del response; el front compila sin esos campos.

**Presupuesto:** ~220 líneas. **Un PR** (o dos si T7.3 se aprueba).

---

## W8 — Hardening de SSE

**Cierra:** M6 (registry sin límite), M8 (réplica/cleanup), M7 (tokens en URL), M9 (drift de `RutasPublicas`).

### T8.1 — Límites del registry
- `SseEmitterRegistry.crear:48-55`: cap por clave (10) y por identidad; 429/503 al exceder.
- `SseTicketService.emitir:54-60`: cap de tickets pendientes (Caffeine con `maximumSize`).
- **Verificación:** test que abre 11 emisores para la misma clave ⇒ el 11 devuelve 429.

### T8.2 — Ciclo de vida
- `@PreDestroy` en `SseEmitterRegistry` llamando `limpiar()` (hoy es código muerto).
- Si W0.2 confirma una sola réplica: documentar y agregar un check de arranque (`app.sse.replica-unicity=true`); si no, broker compartido (fuera de alcance).
- **Verificación:** test de shutdown completa los emisores.

### T8.3 — Tokens fuera de logs
- Mantener el ticket en query (EventSource no permite headers) pero:
  - `application-prod.properties`: acortar `app.sse.ticket-ttl-ms` al mínimo viable (~15 s).
  - Configurar el access log para no registrar query strings (Tomcat `%{queryString}` no se usa; verificar patrón).
- Reset de contraseña: mover el token a fragmento de URL (`#token=`) o a POST de un solo uso.
- **Verificación:** el access log de una conexión SSE no contiene el ticket.

### T8.4 — `RutasPublicas` sincronizado
- Agregar `GET /api/tecnicos/me/ofertas/stream` a `RutasPublicas:26-42`.
- Cambiar `comprobarAnonimo` para leer los matchers de `SecurityConfig` en vez de una segunda lista a mano.
- **Verificación:** `EndpointsProtegidosTest` detecta un `permitAll` nuevo no listado (test de mutación: agregarlo y ver el fallo).

**Presupuesto:** ~180 líneas. **Un PR.**

---

## W9 — Schema: índices, CHECKs y borrados

**Depende de:** W0 (drift confirmado).

### T9.1 — Índices faltantes
Migración `V17__indices_calientes.sql`:
```sql
CREATE INDEX CONCURRENTLY idx_ot_estado_ventana ON ot (estado, ventana_expira_en)
  WHERE estado = 'BUSCANDO_TECNICO';
CREATE INDEX idx_oferta_ot_tecnico_estado ON oferta_ot (tecnico_id, estado);
CREATE INDEX idx_req_insumo_tecnico ON requerimiento_insumo (tecnico_id);
CREATE INDEX idx_req_insumo_item_req ON requerimiento_insumo_item (requerimiento_id);
CREATE INDEX idx_ot_calificacion_tecnico ON ot (calificacion_tecnico_id);
```
> Nota: `CONCURRENTLY` no corre dentro de transacción en Flyway; usar `flyway` con `mixed=true` o dividir en migración aparte.

### T9.2 — Constraints
```sql
ALTER TABLE ot ADD CONSTRAINT chk_auxiliares_no_negativo CHECK (auxiliares_requeridos >= 0);
ALTER TABLE ot ADD CONSTRAINT chk_tarifa_fuente CHECK (tarifa_fuente IS NULL OR tarifa_fuente IN ('MAPS','LINEAL'));
CREATE UNIQUE INDEX idx_oferta_pendiente_unica ON oferta_ot (ot_id, tecnico_id)
  WHERE estado = 'PENDIENTE';
```
- Verificar el enum real de `TarifaFuente` antes de fijar la lista.
- **Verificación:** insertar cada caso inválido ⇒ rechazo.

### T9.3 — `ON DELETE`
- Decidir por FK: `RESTRICT` explícito (recomendado para histórico de OTs) vs `SET NULL`.
- Documentar la decisión; no cambiar a `CASCADE` en tablas con dinero.
- **Verificación:** intento de borrar un cliente con OT ⇒ error claro, no 500 genérico.

**Presupuesto:** ~120 líneas. **Un PR.**

---

## W10 — Robustez del frontend

**Cierra:** F-M3 (cargas silenciosas), F-M4 (poller muerto), F-M5 (mensaje crudo), F-M8 (deps), F-M9 (cobertura), F-M1/F-M2 (mitigaciones), F-M10 (doble poll).

### T10.1 — Cargas con error
- `ot-carga.ts:42`, `ejecucion-ot-page.ts:219`, `diagnostico-ot-page.ts:94`: handler `error:` con estado + retry (patrón de `panel-tecnico-page.ts:91-96`).
- **Verificación:** spec por página con 404/500 ⇒ mensaje y botón.

### T10.2 — Poller de ubicación
- `seguimiento-ot-page.ts:221-230`: `pollVisibleTab(15000)` + `error:` que no mate la suscripción.
- **Verificación:** test con error transitorio ⇒ el poll continúa.

### T10.3 — Mensajes humanos
- `panel-tecnico-page.ts:117`: usar `mensajeErrorAccion(err)`.
- Grep final: 0 sitios con `err.message` o status crudo.
- **Verificación:** test de copy.

### T10.4 — Dependencias
- Quitar `@google/genai`, `motion`, `@angular/cdk` si el grep confirma 0 imports (ya verificado).
- **Verificación:** build + `npm ls` sin esas deps; bundle size antes/después.

### T10.5 — Cobertura
- Specs para `documentos-proveedor-page`, `proveedores-admin-page`, `solicitudes-proveedor-page`.
- `coverageThreshold` en `angular.json` (empezar bajo: 50% líneas, subir después).
- **Verificación:** `npm test -- --coverage` falla si baja del umbral.

### T10.6 — Mitigaciones de token
- `auth.guard.ts:11-13`: verificar `exp` antes de dejar pasar.
- `role.guard.ts`: no decidir por el rol del token; consultar `/api/usuarios/me` (requiere endpoint nuevo, ver follow-up).
- **Verificación:** token expirado ⇒ redirección a login sin 401 en cascada.

**Presupuesto:** ~280 líneas. **Un PR** (o dos).

---

## W11 — Corrección de dominio, errores y auditoría

**Cierra:** M3 (`esTerminal`), M2 (Clock), M4 (error mapping), M9 (audit actor), M11 (fuga de Spring en dominio).

### T11.1 — `EstadoOt.esTerminal()` vs transiciones
- Decidir: o `CANCELADA` deja de ser terminal, o se renombra el predicado y se ajustan consumidores (`ConsultarMetricasAdminUseCase:62`).
- **Verificación:** `TransicionesOtTest` cubre las tres; test de métricas con OT reabierta.

### T11.2 — `Clock` único
- Reemplazar `LocalDate.now(...)`/`Instant.now()` en: `ProgramadorVigencia:27`, `ValidarDocumentacionTecnicoUseCase:42`, `DocumentoTecnicoApiResponse:13`, `ActualizarUbicacionTecnicoUseCase:32`, `RestablecerContrasenaUseCase:44`, `RecuperarContrasenaUseCase:46`, `Usuario:64`, `Proveedor:79`, `Token:25`, `JwtTokenIssuer:32`, `ConsultarMetricasAdminUseCase:109`.
- Preferir pasar `Clock`/`Instant` desde el caso de uso al agregado (los aggregates no deben depender de Spring, pero sí pueden recibir el instante).
- **Verificación:** grep sin `Instant.now()`/`LocalDate.now(` en `main/java` fuera de `ClockConfig`.

### T11.3 — Error mapping uniforme
- Agregar `IllegalArgumentException → 400` y `IllegalStateException → 409` a `OtControllerAdvice` y `OfertaOtControllerAdvice`.
- Reemplazar `ResponseStatusException` en `OtController:155-156` por excepción de dominio.
- Acotar el retry de `CrearOtUseCase:78-87` a violación de unicidad real (inspeccionar constraint).
- **Verificación:** test por cada excepción ⇒ `ApiError` canónico.

### T11.4 — Actor en el historial
- `OtEstadoHistorialRepositoryAdapter.append`: enriquecer `actorUsuarioId` desde `SecurityContextHolder` cuando haya principal.
- **Verificación:** test que cancela como CLIENTE y verifica el id en el historial.

### T11.5 — Fuga de Spring en dominio
- `TecnicoRepository:7` y `DocumentoTecnicoRepository:7`: quitar `@Transactional` del puerto (ya está en el adapter).
- **Verificación:** grep de imports Spring bajo `**/domain/**` vacío.

**Presupuesto:** ~200 líneas. **Un PR.**

---

## W12 — Documentación e higiene del repo

### T12.1 — `ARQUITECTURA.md`
- Corregir: Angular SPA sin SSR ni Ionic/Capacitor; CORS ya existe; CI ya corre tests; plataforma real (Render + Vercel).
- Agregar sección de SSE (contrato real: ticket, TTL, eventos, scoping) y sección de entrega con las variables por plataforma.
- **Verificación:** cada afirmación de la sección de entrega tiene un `file:line` que la respalda.

### T12.2 — `odd/tasks/sse-cobertura-ot.md`
- Marcar `T4` como `[x]` o corregir el log (hoy se contradicen).

### T12.3 — `load-tests/`
- Versionar los escenarios k6 (`load-tests/scenarios/*.js`); dejar solo `results/` ignorado.

### T12.4 — Worktrees y stash
- `git worktree remove` de los dos worktrees en `%TEMP%` (sus ramas ya están en `origin`).
- En el worktree `-hardening`: `git cherry-pick --quit` para limpiar el sequencer.
- `git worktree prune`.
- Revisar el stash (`refs/stash`) antes de descartarlo.

### T12.5 — `.gitignore` del backend
- `backend/.gitignore:40-41`: `.env*` con excepción `!.env.example`.

---

## Delivery
- Estrategia: `ask-on-risk` (default). Ninguna oleada se ejecuta sin confirmación del usuario.
- Presupuesto por PR: ~400 líneas autoradas. W4, W6, W10 y W12 probablemente se parten en dos.
- Cadena sugerida si se aplica todo: `W1 → W2 → W3 → W4a → W4b → W5 → W6a → W6b → W7 → W8 → W9 → W10a → W10b → W11 → W12`.
- Cada PR: un work-unit commit por tarea, tests y docs junto al comportamiento.

## Decisiones de producto pendientes (preguntar antes de implementar)
1. **W5.3** — ¿Una OT en `EN_REPARACION` cuyo técnico fue desactivado debe poder cancelarse automáticamente, o queda para intervención admin?
2. **W7.3** — ¿Aceptamos perder el 409 explícito en el registro duplicado a cambio de cerrar la enumeración?
3. **W10.6** — ¿Se agrega `GET /api/usuarios/me` (y `GET /api/proveedores/me`) para que el front no dependa del token?
4. **W9.3** — Política de borrado: ¿`RESTRICT` en todo lo que tenga histórico de dinero?

## Follow-ups (fuera de alcance)
- Cookies httpOnly + refresh token (cambio de contrato de API).
- Broker SSE compartido (Redis) si se escala a >1 réplica.
- Push real (Firebase/APNs) en lugar de `LoggingNotificacionPushAdapter`.
- Chat real de la OT.
- `ProveedorCercano`/radar con geohash en vez de coordenadas exactas.
- Reemplazar `move`/`cdk` por CSS nativo si no se usan.

## Progress
- 2026-10-19: documento creado desde la auditoría read-only. **Nada implementado.** Baseline `main` = `2c2bf0a`; `ARQUITECTURA.md` con cambios sin commitear.
- 2026-10-19: hallazgos verificados con `file:line`; ver memoria Engram `audit/2026-10-19-seguridad-y-calidad` (id 93) para el detalle completo.
- Pendiente: W0 (drift real de la base) antes de tocar migraciones.



