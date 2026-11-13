# TAREAS-BACKEND — backlog ejecutable

Léelo con `docs/backend/GUIA-BACKEND.md` (ley). Una tarea = un commit. Se acepta **solo** si pasan sus comandos. Origen: revisión de código del 2026-11-12 (solo lectura, **sin ejecutar** la suite: confirma cada hallazgo en el código antes de corregir; los marcados «verificar» no se comprobaron a fondo).

Comandos desde `backend/`. `./gradlew build` necesita Docker (Testcontainers/PostGIS).
Leyenda: 🟢 modelo barato suficiente · 🟡 conviene más capaz o revisión humana. Severidad: alta/media/baja.

Orden: `TB-01 → TB-02 → TB-04 → TB-05 → TB-06 → TB-07 → TB-03 → TB-08 → TB-09 → TB-10`.

---

### TB-01 🟡 (alta) Paginar/limitar lecturas de administración y métricas
**Problema:** no existe `Pageable` en el backend. `AdminController` llama `listarOts.listarTodas()` y `listarTodas()` de liquidaciones y disputas; `ConsultarMetricasAdminUseCase` carga `findByActivoTrue()` y `liquidacionRepository.listarTodas()` (~línea 144). Con datos reales es O(tabla) en memoria.
**Pasos:** agrega paginación por `page/size` (máx. 100) o filtros por rango de fechas; devuelve `{items, page, size, total}`. Métricas: agregar con consultas `COUNT/SUM` en BD, no cargando entidades. Mantén compatibilidad: valor por defecto razonable para no romper el frontend; actualiza `@core` del frontend.
**Aceptación:** `node scripts/check-backend-rules.mjs` baja `BE-P1` (13 → menos; objetivo 0 en admin/métricas); test de integración con 500 filas que verifique tope y orden; `./gradlew build` OK.

### TB-02 🟢 (media) Unificar el formato de error
**Problema:** `SecurityConfig` y `MapsControllerAdvice` devuelven `List<ApiError>`; `GlobalControllerAdvice` y el `handleValidation` de Maps devuelven un `ApiError`. `RateLimitFilter` ya lo reconoce en un comentario.
**Pasos:** elige **una** forma (`ApiError` con `errores: []`), migra los 4 puntos, y documenta en `GUIA-BACKEND.md` §3.
**Aceptación:** test parametrizado que provoque 400, 401, 403, 404, 409, 429 y 502 y afirme **la misma forma JSON** (campos `status`, `mensaje`, `errores`); el frontend sigue funcionando (`mensajeErrorAccion`); `build` OK.

### TB-04 🟢 (media) Verificar seed apagado y logs sensibles en prod
**Verificar primero:** `application-prod.properties` fija `app.seed.enabled=false` (el seeder usa `matchIfMissing=true`); `logToken` está en `false` en prod; `LoggingNotificadorRecuperacion` no loguea el token ni el correo completo a INFO.
**Pasos:** fija explícitamente `app.seed.enabled=false` en prod; enmascara el correo en logs (`m***@dominio.co`); asegura `logToken=false` por defecto.
**Aceptación:** test de contexto con perfil `prod` que verifica que no existe el bean `DevDataSeeder`; test que verifica que el log no contiene el token.

### TB-05 🟢 (media) Ampliar rate limit y acotar `/api/tecnicos/cercanos`
**Problema:** el rate limit cubre solo POST en 7 rutas exactas. No cubre `/api/maps/*` (consume la server key de Google), `/api/tecnicos/cercanos` (sin `LIMIT`) ni `POST /api/ot`. `PostgisTecnicoDisponibilidadAdapter` no limita resultados.
**Pasos:** agrega esas rutas a la configuración del limitador (límites propios, mayores que los de auth); añade `LIMIT` (p. ej. 50) a la consulta de cercanos.
**Aceptación:** test que obtiene 429 en `/api/maps/autocomplete` tras N llamadas; test con 500 técnicos que espera ≤50; `build` OK.

### TB-06 🟢 (media) Idempotencia en altas críticas
**Problema:** `POST /api/ot/{id}/insumos` y las altas no son idempotentes; dos clics = dos solicitudes y dos broadcasts. Hoy se mitiga con debounce en la UI.
**Pasos:** acepta `Idempotency-Key` (cabecera) o una restricción única de negocio; segunda petición igual devuelve el recurso existente.
**Aceptación:** test: dos POST iguales seguidos crean **una** solicitud y un solo broadcast.

### TB-07 🟢 (media) Revisar `versionVigente` y `LimpiarOrdenesHuerfanasUseCase`
**Verificar:** `JwtAuthenticationFilter.versionVigente` conserva `.orElse(true)` para un `sub` inexistente (deuda declarada en comentario): un token de usuario borrado sigue válido hasta expirar. `LimpiarOrdenesHuerfanasUseCase.ejecutar()` corre cada 5 min: comprobar que no carga toda la tabla `ot`.
**Pasos:** si se confirma, `orElse(false)` para sub inexistente (con test); consulta acotada para huérfanas (índice por estado+fecha).
**Aceptación:** test de token de usuario eliminado ⇒ 401; test del barrido con 10k OTs no carga todas (verifica por consulta/`EXPLAIN` o por conteo de entidades).

### TB-03 🟡 (alta si hay >1 instancia) Jobs programados con bloqueo
**Problema:** 5–7 `@Scheduled` (escalamiento, huérfanas, expiración de insumos, reconciliación de técnicos, vigencia) sin ShedLock. Además el registro SSE es en memoria. Hoy corre 1 instancia.
**Decisión previa (pregunta al dueño):** ¿se escalará a >1 instancia? Si **no**: documenta "1 instancia" en `render.yaml` y en `GUIA-BACKEND.md` y sube un comentario `// una sola instancia` junto a cada `@Scheduled` (esto no baja `BE-J1`; ajústalo con aprobación). Si **sí**: ShedLock (tabla `shedlock`, migración V17) + `@SchedulerLock`, y SSE vía broker (fuera de alcance de esta tarea).
**Aceptación:** `BE-J1` baja a 0 (caso "sí") o decisión documentada (caso "no"); test que lance dos ejecuciones concurrentes del job y compruebe un único efecto.

### TB-08 🟢 (baja) Operabilidad
Probe `GET /actuator/health/readiness` y `liveness` separados; id de correlación en logs (MDC por petición); no exponer más de `health,info` salvo con auth. **Aceptación:** `curl localhost:8090/actuator/health/readiness` ⇒ 200; los logs de una petición comparten `correlationId`.

### TB-09 🟢 (baja) Cobertura de pruebas en `tecnicos` y `administracion`
Ratio test/main: `tecnicos` 11/61 y `administracion` 7/49 (los más flacos). Para cada controlador sin test: 401, 403 con rol equivocado y camino feliz. **Aceptación:** los tests nuevos pasan; cada controlador de esos módulos tiene al menos ese trío.

### TB-10 🟡 (baja) Datos de seed para ver todas las pantallas  *(habilita TU-08)*
En `DevDataSeeder` (solo perfil `dev`, idempotente): una OT en cada estado del ciclo (`SOLICITADA`…`FINALIZADA`, `DISPUTADA`), una oferta pendiente para `tecnico1`, una solicitud de insumos para `proveedor1` habilitado, y `proveedor1` con cuenta habilitada. **Aceptación:** `./gradlew bootRun` crea los datos sin duplicar en reinicios; el seed sigue apagado en prod (TB-04); un test de contexto lo verifica.

### Menores a verificar (sin tarea propia)
- `FORWARD_HEADERS_STRATEGY:NATIVE` + rate limit por `getRemoteAddr()`: seguro solo detrás del proxy de Render.
- `Dockerfile` hace `bootJar -x test` con `autoDeploy:true` en `render.yaml`: el CI sí corre `build`, pero un deploy automático sin gate de merge saltaría los tests. Exige el check "Backend CI" en la protección de `main`.
- `springdoc-openapi 2.8.5` frente a Spring Boot 4.1.1: apagado en prod; comprobar que arranca en dev.
- GitHub Actions fijadas por tag (`@v4`), no por SHA.

## Fuera de alcance
Reescribir módulos, cambiar de framework, microservicios, broker SSE (salvo decisión de TB-03).
