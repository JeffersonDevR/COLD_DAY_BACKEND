# Auditoría — fallas, fugas, ataques comunes y arquitectura

Fecha: 2026-11-09 · Alcance: repo completo (backend Spring Boot 4.1.1/Java 25, frontend Angular + proyectos `mobile`/Ionic, `landing/`, infra Docker/Render/Vercel, CI).
Método: lectura de código, migraciones Flyway y configuración; `git ls-files` y `git log -S` para secretos; verificación cruzada de cada hallazgo contra `archivo:linea`. Sin cambios aplicados.

---

## 0. Veredicto en una línea

El **núcleo de autorización está bien** (no hay IDOR, no hay SQLi, JWT/bcrypt/tickets SSE bien construidos). Las fallas están en los **bordes**: una configuración que puede arrancar *fail-open*, credenciales de ejemplo que se aceptan en producción, throttling a medias, PII expuesta en un endpoint, y una capa de datos sin paginación ni índices para las consultas que ya existen.

Además, este repo **ya tiene un plan de hardening escrito** (`odd/tasks/hardening-seguridad-confiabilidad.md`, 2026-10-19) con 12 oleadas. Verificado hoy: **la mayoría sigue sin implementarse**. Donde un hallazgo coincide con ese plan, lo marco con `(ya planificado: Tx.x)` para que no se duplique el trabajo.

---

## 1. Lo que está bien y no hay que tocar

Verificado, con evidencia:

| Área | Evidencia |
|---|---|
| Autorización por caso de uso, no por path | 78 endpoints revisados uno a uno; `AutorizacionPropietario.java:44-139`; cada endpoint de `/api/ot` resuelve el participante (`OtController.java:140,148,163`) |
| Sin SQLi | Todas las queries son JPQL derivadas o `setParameter` (`PostgisTecnicoDisponibilidadAdapter.java:86-91`, `OtRepositoryAdapter.java:60-63`) |
| Sin mass assignment de rol | `UsuarioApiRequest.java:9-31` sin campo `rol`; el server fuerza `Rol.CLIENTE` (`UsuarioController.java:118-121`), `Rol.TECNICO` en `RegistrarTecnicoUseCase.java:51` |
| Contraseñas | BCrypt costo 12 (`PasswordEncoderAdapter.java:15`) |
| Reset de contraseña | 32 bytes `SecureRandom` + SHA-256 en reposo + un solo uso + 30 min (`SecureRandomTokenGenerator.java:21-31`, `RecuperarContrasenaUseCase.java:26,44-59`) |
| No enumeración en reset | `RecuperarContrasenaUseCase.java:50-53` |
| SSE: ticket de un solo uso, hasheado, TTL | `SseTicketService.java:54-76`; rol verificado desde el ticket (`AdminStreamController.java:56-60`) |
| CORS exacto, sin comodines, sin credenciales | `SecurityConfig.java:144-155`, `CorsProperties.java:26-39` |
| Errores sin stacktrace en prod | `application-prod.properties:84-87`; `GlobalControllerAdvice.java:134-141` solo loguea |
| Esquema versionado + tests de integración reales | `db/migration/V1..V14`, 130+ suites con Testcontainers/PostGIS |

---

## 2. Resumen de hallazgos

| ID | Hallazgo | Sev. | Área | Esf. |
|---|---|---|---|---|
| C1 | Perfil `dev` por defecto = bypass de autenticación si falta la variable de perfil | Crítico | Config | S |
| C2 | Secreto JWT de desarrollo publicado y aceptado en cualquier entorno | Crítico | Config | S |
| A1 | Sin política de contraseña (ni mínimo) en ningún alta/reset | Alto | Auth | S |
| A2 | Rate limit solo en 4 rutas y sin dimensión de cuenta; registro público con bcrypt 12 sin cupo = DoS de CPU | Alto | Abuso | M |
| A3 | La server key de Google Maps puede filtrarse en el cuerpo de un 502 | Alto | Fuga | S |
| A4 | `/api/tecnicos/cercanos` entrega GPS exacto + teléfono de todos los técnicos disponibles | Alto | PII | M |
| A5 | Revocación JWT incompleta: usuario borrado/inactivo sigue autenticando | Alto | Auth | S |
| A6 | Sin paginación; el tablero admin hidrata todas las OTs, liquidaciones y técnicos en JVM | Alto | Datos | M |
| A7 | Índice espacial GiST solo en V1, que **no corre** en la BD baselineada de producción | Alto | Índices | S |
| A8 | `findByCorreo` no puede usar el índice único parcial (`WHERE activo`) → seq scan en cada login | Alto | Índices | S |
| A9 | El `@Version` está anulado: `save()` re-lee y sobrescribe + bulk updates con `clearAutomatically` → lost update | Alto | Concurrencia | M |
| A10 | `render.yaml` no define `CORS_ALLOWED_ORIGINS` (obligatoria, sin default) → el blueprint no arranca | Alto | Deploy | S |
| A11 | Sin headers de seguridad en Vercel y JWT en `localStorage` | Alto | Frontend | S |
| A12 | La misma API key de Google Maps se usa como browser key y como server key: la server key acaba en el bundle público | Alto | Fuga | S |
| A13 | El barrido de ofertas de insumos hace seq scan de toda la tabla cada 60 s (tabla que nunca se purga) | Alto | Índices | S |
| A14 | `requerimiento_insumo_item`: FK sin índice + `@OneToMany` EAGER → seq scan de la tabla hija por cada solicitud | Alto | Índices | S |
| A15 | La limpieza de órdenes huérfanas carga **toda** la tabla `ot` cada 5 min | Alto | Datos | M |
| A16 | Doble asignación de un técnico: `estado_operativo` se valida en memoria y se escribe sin condición (no hay `@Version` en `tecnico`) | Alto | Concurrencia | M |
| M1 | N+1 al resolver nombres de cliente/técnico en listados | Medio | Datos | M |
| M2 | FKs creadas `NOT VALID` y nunca validadas | Medio | Datos | S |
| M3 | SSE sin tope por canal/usuario ni `@PreDestroy` | Medio | Abuso | S |
| M4 | Tokens mock + `MockDbService` dentro del bundle de producción; `switchDemoRole` invocable desde consola | Medio | Frontend | M |
| M5 | Config de Sonar excluye una ruta que no existe → la API key real sí se analiza/publica | Medio | Fuga | S |
| M6 | CI sin escaneo de dependencias y acciones fijadas por tag, no por SHA | Medio | Supply chain | M |
| M7 | `gradle-wrapper.properties` sin `distributionSha256Sum` | Medio | Supply chain | S |
| M8 | Manifiesto Android con `usesCleartextTraffic="true"` y `allowBackup="true"` | Medio | Mobile | S |
| M9 | Build de producción sin `API_ORIGIN` se genera "verde" y la app 404ea en runtime | Medio | Deploy | S |
| M10 | Enumeración de cuentas: el 409 de registro devuelve el correo y delata el rol por endpoint | Medio | Auth | S |
| M11 | Oráculo de timing en login (sin bcrypt dummy cuando el correo no existe) | Medio | Auth | S |
| M12 | Controles demo en producción que fabrican evidencia (foto stock, PDF inexistente, radio simulado) y URLs de evidencia sin validar en servidor | Medio | Integridad | M |
| M13 | Guards deciden rol con claims sin verificar y sin comprobar `exp` (gating solo-cliente) | Medio | Frontend | M |
| M14 | El artefacto desplegado no pasa por tests (`bootJar -x test` + `autoDeploy: true`) | Medio | CI/CD | S |
| M15 | PII en logs de producción: correo del usuario a nivel INFO | Medio | Logs | S |
| M16 | Rate limit evadible por `X-Forwarded-For` cuando el 8090 se expone directo (`forward-headers-strategy=NATIVE`) | Medio | Abuso | S |
| B1 | `cliente/ot/*` sin `roleGuard` | Bajo | Frontend | S |
| B2 | Carrera del código `OT-YYYY-####` (MAX + unique index), admitida en el código | Bajo | Datos | S |
| B3 | Sin CHECK de `auxiliares_requeridos >= 0` ni unicidad de oferta pendiente por (ot, técnico) | Bajo | Datos | S |
| B4 | Oráculo de estado de OT: la transición se valida antes que la propiedad (409 vs 403) | Bajo | AuthZ | S |
| B5 | Proxy de Google Maps sin cupo: cualquier cuenta gratuita consume la server key | Bajo | Costo | S |
| B6 | `environment.backendUrl` a `localhost:8090` empaquetado y sin uso | Bajo | Frontend | S |
| B7 | `docker-compose` activa un perfil `postgres` que no existe | Bajo | Infra | S |
| B8 | `backend/local.properties` versionado (ruta local del desarrollador) | Bajo | Higiene | S |
| B9 | `docker-compose.yml` publica Postgres en `0.0.0.0:5433` con password fija | Bajo | Infra | S |
| B10 | Token de reset viaja en query string | Bajo | Fuga | S |
| B11 | `proxy.conf.json` desactualizado: SSE, proveedores, insumos y config de mapas no llegan al backend en `ng serve` | Bajo | Dev | S |
| B12 | Logout incompleto: quedan PII en `sessionStorage`/`localStorage` | Bajo | Frontend | S |
| B13 | La sesión no muestra nombre (toast "Sesión iniciada como ") | Bajo | Frontend | S |
| B14 | `@google/genai` declarado sin uso + `metadata.json` con capacidad Gemini | Bajo | Supply chain | S |
| B15 | `landing/script.js` con `APP_URL` placeholder y leads que solo abren un `mailto` | Bajo | Landing | S |
| B16 | La plataforma `frontend/android/` **no está versionada**: cualquier hardening del manifiesto se pierde al regenerar | Bajo | Mobile | S |
| B17 | `springdoc-openapi 2.8.5` es de la línea de Boot 3 contra Boot 4.1.1 (compatibilidad a verificar) | Bajo | Deps | S |
| B18 | Imágenes base por tag mutable (`eclipse-temurin:25-*`), rebuild no reproducible | Bajo | Infra | S |
| B19 | `.dockerignore` no excluye `local.properties` | Bajo | Higiene | S |
| B20 | `engines.node` permite Node 20 (EOL) mientras el CI usa 22 | Bajo | Deps | S |

---

## 2-bis. Los patrones de "vibecoding" que sí están acá

El repo no cae en los típicos (no hay IDOR, no hay SQLi, no hay sinks de HTML), pero sí en estos, que son los que sobreviven a una revisión por features:

| Patrón | Dónde se materializa | Hallazgo |
|---|---|---|
| **Default cómodo que se vuelve política de seguridad** | Perfil `dev` activo por defecto, con bypass de auth | C1 |
| **Credencial de ejemplo que es funcional** | `JWT_SECRET` del `.env.example` aceptado en prod; una sola key de Maps para web y server | C2, A12 |
| **Demo que se queda en el build** | `switchDemoRole`, `MockDbService`, "Cargar Foto Demo", PDF inexistente, radar simulable | M4, M12 |
| **Feature a medias sin control de borde** | La evidencia es una URL de texto: no hay upload ni validación | M12 |
| **Verde que miente** | Build sin `API_ORIGIN` sale OK y 404ea en runtime; el artefacto desplegado no pasa tests | M9, M14 |
| **Efecto secundario olvidado al refactorizar** | `findByCorreo` dejó de coincidir con el índice parcial que V3 introdujo | A8 |
| **Optimización de concurrencia a medias** | `@Version` existe en las entidades pero los bulk updates lo esquivan | A9, A16 |
| **Documentación que ya no es verdad** | Sonar excluye una ruta inexistente; `postgres` es un perfil fantasma; "la server key nunca sale del backend" | M5, B7, A12 |
| **Nada se pagina porque "hay pocos datos"** | 10 queries con la tabla entera, `findAll` sin orden, barridos que leen todo | A6, A13, A15 |
| **Config duplicada entre repos y entornos** | `render.yaml` incompleto, proxy desactualizado, `backendUrl` muerto | A10, B11, B6 |

---

## 3. Crítico

### C1 — El perfil por defecto es `dev`: sin variable de entorno, la API arranca **sin autenticación**

- `backend/src/main/resources/application.properties:11` → `spring.profiles.active=dev`
- `backend/src/main/resources/application-dev.properties:41` → `app.security.dev-bypass.enabled=${DEV_AUTH_BYPASS:true}`
- `DevAuthBypassFilter.java:48-50,78-90` → toda petición sin JWT se autentica como el **admin sembrado**

Hoy hay dos mitigaciones accidentales: el `Dockerfile` fija `ENV SPRING_PROFILES_ACTIVE=prod` (`Dockerfile:34`) y `render.yaml:19-20` lo fija también. Pero cualquier ejecución que no pase por esa imagen (`java -jar app.jar`, un `RUN` de Docker distinto, un futuro PaaS, un `docker run` con otra imagen base) arranca en `dev` y **cualquiera es administrador**. Además el `DevAuthBypassFilter` solo se niega a existir con el perfil `prod` literal (`DevAuthBypassFilter.java:63-67`), no con "cualquier perfil que no sea dev".

Es el patrón clásico de vibecoding: *un default cómodo para el que programa se convierte en la política de seguridad del despliegue*.

**Fix (2 líneas + 1 guard):**
1. Borrar `spring.profiles.active=dev` de `application.properties`. Sin perfil activo, `app.jwt.secret` no existe y `JwtProperties` falla al arrancar (fail-closed).
2. En `DevAuthBypassFilter`, sustituir la comprobación de `prod` por: *solo se permite si el perfil `dev` está activo*.
3. Documentar `--spring.profiles.active=dev` en `.env.example` y en el README.

### C2 — El secreto JWT de desarrollo está publicado en el repo y se acepta como válido en producción

- `backend/.env.example:8` → `JWT_SECRET=cold-day-dev-secret-key-change-me-32-bytes !!`
- `JwtProperties.java:19` declara `DEV_DEFAULT_SECRET` **y nunca lo usa**; `JwtProperties.java:21-31` solo valida que no esté vacío y mida ≥32 bytes (este literal mide 45).
- `application-dev.properties:27` lo usa como default.

Consecuencia: quien copie el `.env.example` a `.env` (el instructivo del propio archivo lo invita) despliega con un secreto **público**. Con el secreto, cualquiera firma un HS256 con `sub` = id de un admin, `rol`/`roles` = `["ADMINISTRADOR"]` y `ver` = versión vigente, y la API lo acepta: `JwtAuthenticationFilter.java:49-73` solo verifica firma y que `ver` coincida. **Toma de control total** sin tocar la base.

**Fix:** usar el `DEV_DEFAULT_SECRET` que ya está declarado como guard (fallar si `secret == DEV_DEFAULT_SECRET` y el perfil activo no es `dev`); cambiar el `.env.example` a `PEGA_AQUI_UN_SECRETO_ALEATORIO_DE_32_BYTES`; y añadir un test `JwtPropertiesTest` con los tres casos (dev+default OK, prod+default excepción, prod+real OK). `(ya planificado: T1.2)`

---

## 4. Alto

### A1 — No hay política de contraseña en ninguna entrada

`CredencialesApiRequest.java:8-9`, `RestablecerContrasenaApiRequest.java:5-7`, `TecnicoApiRequest.java:17`, `UsuarioApiRequest.java:28`, y el agregado `Usuario` no valida longitud (`Usuario.java:95-99` solo compara hashes). Un `password: "1"` es aceptado en login, registro, alta de técnico, alta de proveedor y reset. Con bcrypt costo 12 la fuga no es por cracking masivo, es por **reutilización**: el usuario elige "1234" y el atacante ni necesita fuerza bruta.

Añadir además `@Size(max = 72)` es correcto y no arbitrario: BCrypt trunca en 72 bytes.

**Fix:** `@Size(min = 8, max = 72)` en los cinco records + validación equivalente en `Usuario.registrar`/`cambiarPassword` (defensa en profundidad) + tests de 400. `(ya planificado: T7.2)`

### A2 — El rate limit protege cuatro rutas y no mira la cuenta; el registro público sin cupo es un DoS de CPU

- `RateLimitFilter.java:69-73`: solo `POST /api/usuarios{,/login,/recuperar-contrasena,/reset-contrasena}`.
- `SecurityConfig.java:86-88` abre además `POST /api/tecnicos`, `/api/clientes` y `/api/proveedores`, que **crean usuarios con bcrypt costo 12** (`RegistrarTecnicoUseCase.java:51`, `RegistrarClienteUseCase`, `RegistrarProveedorUseCase`).
- `RateLimitFilter.java:105`: la clave es `IP + ruta`; no hay dimensión por correo.

Dos ataques concretos:
1. **CPU exhaustion**: cada alta ejecuta ~250 ms de bcrypt en un `Render free` (0.1–0.5 vCPU). Unas decenas de peticiones concurrentes saturan el proceso; el resto de la API deja de responder. Sin cupo, es trivial.
2. **Fuerza bruta distribuida**: 10 intentos/min por IP y ruta son irrelevantes contra un solo correo desde N IPs, y con A1 (passwords débiles) la tasa de acierto es alta.

**Fix:** añadir las tres rutas públicas al cupo; segunda clave por `correo` del cuerpo en login/recuperación (mismo Caffeine, `maximumSize` acotado); subir el costo de registro a un cupo más bajo (p. ej. 3/min/IP); y valorar un challenge (captcha/turnstile) solo si el abuso se confirma en producción. `(ya planificado: T7.1)`

### A3 — La *server key* de Google Maps puede terminar en el cuerpo de un 502

- `GoogleMapsAdapter.java:197-203`: cualquier excepción del cliente HTTP se re-envuelve como `IllegalStateException("No se pudo contactar Google Maps Platform: " + ex.getMessage())`.
- `MapsControllerAdvice.java:41-45`: ese `IllegalStateException` se devuelve **al cliente** como `502` con `ex.getMessage()`.
- La petición lleva la clave en la query string (`GoogleMapsAdapter.java:67-72` y ss.: `.queryParam("key", props.apiKey())`).

Los mensajes de error de los clientes HTTP de Spring incluyen la URI de la petición; un fallo de red/4xx devuelve entonces un texto con `...?key=AIza...` a cualquier usuario autenticado, y además lo escribe en el log de errores. Es una fuga de credencial facturable (la server key no está restringida por referrer, solo por IP, y sale del backend).

**Fix:** responder un mensaje fijo (`"No se pudo contactar el proveedor de mapas"`) y loguear el detalle sin la URL (o con la key redactada); no reenviar `ex.getMessage()` de excepciones de infraestructura. Ya existe el patrón correcto en `GlobalControllerAdvice.java:73-83`.

### A4 — `/api/tecnicos/cercanos` entrega el GPS exacto de todos los técnicos disponibles

- `TecnicoCercanoApiResponse.java:14-19`: devuelve `nombre`, `telefono`, `fotoUrl`, `latitud`, `longitud` de cada técnico.
- `TecnicoController.java:150-161`: accesible a `CLIENTE` y `TECNICO`, **sin ninguna relación con el técnico**, con radio de hasta 100 km (`:155`) y sin límite de resultados ni cupo.
- `PostgisTecnicoDisponibilidadAdapter.java:43-61`: sin `LIMIT`.

Como el alta de cliente es pública, cualquier atacante crea una cuenta y barre coordenadas para reconstruir la posición en vivo de toda la flota con nombre, teléfono y foto. En Colombia eso es tratamiento de datos personales (Ley 1581/Habeas Data) y un riesgo físico real para el técnico.

**Fix:** quitar `latitud`/`longitud` (el radar ya usa `distanciaKm`) y `telefono` de la respuesta; el contacto se expone solo cuando hay una OT asignada; añadir `LIMIT` y cupo por usuario. `(ya planificado: T7.5)`

### A5 — La revocación de token no cubre al usuario borrado ni al inactivo

- `JwtAuthenticationFilter.java:110-114`: `.orElse(true)` → si el `sub` **no existe**, el token sigue siendo válido.
- `AutenticarUsuarioUseCase.java:34-46`: no consulta `usuario.isActivo()`; `Usuario.verificarCredenciales` (`Usuario.java:95-99`) tampoco.
- `EliminarTecnicoUseCase.java:20-25`: desactiva el perfil del técnico sin incrementar `tokenVersion` del usuario.

Resultado: un técnico "eliminado" conserva su JWT hasta 1 h y sigue pasando `hasRole('TECNICO')`; un usuario desactivado puede volver a hacer login y obtiene token nuevo.

**Fix:** `.orElse(false)`; rechazar `!isActivo()` en login; `incrementarTokenVersion()` al desactivar el perfil; test de token de usuario eliminado ⇒ 401. `(ya planificado: T7.4)`

### A6 — Sin paginación; el tablero admin carga toda la base en memoria

- `AdminController.java:59-65`: `listarOts.listarTodas()` → todas las OTs + resolución de nombres.
- `AdminController.java:68-102`: liquidaciones y disputas completas.
- `ConsultarMetricasAdminUseCase.java:53-87`: itera los 10 estados y hace **una consulta por estado** (`buscarPorEstado`), acumula todas las OTs en una lista, hidrata todos los técnicos (`findByActivoTrue`) y **todas** las liquidaciones (`liquidacionRepository.listarTodas()`, línea 132) solo para sumar el mes.

Con 50 000 OTs esto es: 10 queries que devuelven la tabla entera, 50 000 objetos de dominio, ~150 000 comparaciones de fecha en `historicoSemanal` (líneas 106-124) y el heap de un contenedor de 512 MB. El tablero se refresca además por SSE, así que es un bucle.

**Fix:** una consulta agregada (`SELECT estado, count(*) FROM ot GROUP BY estado`), sumas por `date_trunc('month', creada_en)` en SQL, y `page`/`size` con default 50 en los tres listados. `(ya planificado: T6.1)`

### A7 — El índice espacial existe solo en V1, y V1 no corre en la base de producción

- `V1__baseline_esquema_actual.sql:254-259` crea `idx_tecnico_disponible_ubicacion_geo` (GiST funcional parcial), el único índice que puede servir al radar.
- `application.properties:38-39`: `spring.flyway.baseline-on-migrate=true` + `baseline-version=1`; el propio V1 se documenta como "NUNCA se ejecuta contra una base que ya tiene el esquema" (`V1__baseline_esquema_actual.sql:8-13`).

Los índices de las entidades sí existen en producción porque los creó Hibernate (`@Table(indexes=…)`), pero **este no**: es funcional y parcial, Hibernate no lo genera, y solo vive en V1.

Consecuencia: en la base real, `PostgisTecnicoDisponibilidadAdapter.buscarDisponiblesEnRadio` hace *sequential scan* + cálculo de distancia para toda la tabla `tecnico` **en cada búsqueda de despacho**, y el despacho busca en cada creación de OT.

**Fix (verificar primero con `W0`):** migración aditiva `V15` que cree el índice si falta:

```sql
CREATE INDEX IF NOT EXISTS idx_tecnico_disponible_ubicacion_geo
  ON tecnico USING GIST ((ST_MakePoint(longitud, latitud)::geography))
  WHERE activo = true AND estado_validacion = 'APROBADO' AND estado_operativo = 'DISPONIBLE';
```

### A8 — El índice de login no puede usarse: `findByCorreo` sin el predicado parcial

- `V3__indices_unicos_parciales.sql:32-33`: `CREATE UNIQUE INDEX uk_usuario_correo_activo ON usuario (correo) WHERE activo = true;`
- `SpringDataUsuarioRepository.java:9`: `findByCorreo(correo)` → `WHERE correo = ?` **sin** `activo = true`.

PostgreSQL **no** usa un índice parcial si la consulta no incluye su predicado. Cada login (y cada `existsByCorreo` del registro, línea 11, que tampoco filtra `activo`) es un *seq scan* sobre `usuario`. Hoy con pocos usuarios no se nota; con 100 000 usuarios son ~40 MB leídos por intento de login, y el rate limit no protege de eso porque el costo está antes de bcrypt.

Hay además una inconsistencia semántica: el índice parcial permite reutilizar el correo de una cuenta inactiva, pero el pre-chequeo de la aplicación (`RegistrarUsuarioUseCase.java:34`) es *table-wide* y la rechaza igual.

**Fix:** `findByCorreoAndActivoTrue(...)` + `existsByCorreoAndActivoTrue(...)` (consistente con el soft-delete que V3 quiso dar), o un índice completo `CREATE INDEX idx_usuario_correo ON usuario (correo)` si se quiere servir también la búsqueda de inactivos.

### A9 — El control de concurrencia está anulado en la práctica

- `OtRepositoryAdapter.java:65-74`: el `save()` re-lee la fila y le aplica **todas** las columnas del agregado en memoria (`existing.applyFromDomain(ot)`) — pisa lo que otra transacción haya escrito.
- `SpringDataOtRepository.java:33-41`: `asignarSiDisponible` es un UPDATE condicional que **no incrementa `version`**.
- `SpringDataOfertaOtRepository.java:27,37`: los bulk updates de ofertas usan `clearAutomatically = true`, lo que **desadjunta las entidades de `ot`** y deja el `@Version` sin vserse.
- `OtJpaEntity`/`Ot` usan `@Version` (`V1:110` columna `version`), pero nada de lo anterior lo hace cumplir.

Escenario real: el barrido de escalamiento (`ProgramadorEscalamientoOt`, cada 5 s) lee una OT en `BUSCANDO_TECNICO` con versión `v`, y en paralelo un técnico acepta la oferta (`asignarSiDisponible`, que deja `version` en `v`). Cuando el barrido guarda, su `UPDATE ... WHERE id=? AND version=v` **coincide** y revierte `estado`/`tecnico_id` a `BUSCANDO_TECNICO`: la asignación se pierde y la OT queda en un estado imposible (buscando técnico con técnico asignado). El `@Version` no protege precisamente porque el bulk no lo movió. El plan ya documenta este escenario (C4/H1/H2) y **sigue abierto**.

**Fix:** cargar con `entityManager.find(..., LockModeType.OPTIMISTIC)` y comparar `version` contra la del agregado, o un UPDATE condicional `WHERE id = ? AND version = ?` que devuelva 0 filas ⇒ `OptimisticLockingFailureException` (ya mapeada a 409 en `GlobalControllerAdvice.java:64-71`); hacer que el barrido también sea condicional (`WHERE estado='BUSCANDO_TECNICO' AND ventana_expira_en <= ?`) y añadir `o.version = o.version + 1` a los bulk de `ot`; quitar el `clearAutomatically` de los bulk de `oferta_ot`. `(ya planificado: T4.2–T4.4)`

### A10 — `render.yaml` no define `CORS_ALLOWED_ORIGINS`, que es obligatoria y sin default

- `application-prod.properties:67`: `app.cors.allowed-origins=${CORS_ALLOWED_ORIGINS}` (sin valor por defecto).
- `CorsProperties.java:34-38`: si queda vacía o con el placeholder sin resolver, **lanza** en el arranque.
- `render.yaml:18-37`: define `SPRING_PROFILES_ACTIVE`, `SPRING_JPA_HIBERNATE_DDL_AUTO`, `JWT_SECRET`, `POSTGRES_*`, `GOOGLE_MAPS_*`… y **no** `CORS_ALLOWED_ORIGINS` (ni `MAIL_RESET_URL_BASE`).

Un despliegue creado desde el blueprint falla al arrancar. Que hoy funcione implica que la variable se puso a mano en el dashboard: el repo dejó de ser la fuente de verdad del entorno, y un entorno nuevo no se puede reconstruir. Falta también `GOOGLE_MAPS_BROWSER_API_KEY` (`application.properties:102`), sin la cual `/api/config/maps` sale sin browser key, y no hay bloque `databases:` (la base se crea a mano). Mismo hueco que ya detectó T1.3.

**Fix:** añadir `CORS_ALLOWED_ORIGINS`, `MAIL_RESET_URL_BASE` y `GOOGLE_MAPS_BROWSER_API_KEY` con `sync: false`, declarar el datastore en el blueprint, y un test (o script de CI) que compare las `${VAR}` sin default de `application-prod.properties` contra las `key:` del blueprint.

### A11 — Sin headers de seguridad en el frontend y JWT en `localStorage`

- `frontend/vercel.json`: solo `framework`, `buildCommand`, `outputDirectory` y `rewrites`. **Cero headers**: sin CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` ni HSTS.
- `token-storage.service.ts:33-48`: el JWT se guarda en `localStorage`.

No encontré sinks de XSS (`innerHTML`/`bypassSecurityTrust`/`eval`) en `frontend/src`, así que el riesgo es latente, no activo. Pero con el token en `localStorage` y sin CSP, **cualquier** XSS futuro (una dependencia, un `innerHTML` que alguien añada, un mapa/loader de terceros) se convierte en robo de sesión de 1 h, sin mitigación posible del lado del servidor salvo esperar la expiración.

**Fix:** bloque `headers` en `vercel.json` con CSP que permita solo el origen de la API y Google Maps, más `nosniff`/`DENY`/HSTS/`strict-origin-when-cross-origin`. Migrar el token a cookie `httpOnly`+`SameSite` es un cambio de contrato y está explícitamente fuera del plan actual (decisión de producto), pero la CSP es 10 líneas y ya está planificada. `(ya planificado: T3.2; token en localStorage: decisión pendiente)`

### A12 — La misma API key de Google Maps hace de *browser key* y de *server key*

- `frontend/.env:3` y `backend/.env:3` tienen **el mismo valor** (`AIza…`).
- El build del front lo inyecta en `maps-key.ts` (`scripts/generate-maps-key.mjs`) y `environment.ts:1,35` lo importa → viaja en el bundle público de Vercel.
- El backend usa `app.maps.api-key=${GOOGLE_MAPS_API_KEY:}` (`application.properties:88`) para Geocoding/Directions facturados, y admite una browser key aparte (`application.properties:102`, `GOOGLE_MAPS_BROWSER_API_KEY`) que **no está configurada**.

Esto rompe la garantía que el propio diseño declara ("la server key nunca sale del backend", `SecurityConfig.java:76-77`) y que `backend/.env.example:10-18` explica: una sola key no puede estar restringida a la vez por HTTP referrer (lo que el front necesita) y por IP (lo que el backend necesita). En la práctica queda sin restricción útil → cualquiera copia la key del JS y consume la cuota facturada.

**Fix:** rotar la key y crear dos: **browser key** restringida por referrer + APIs de mapas → `GOOGLE_MAPS_BROWSER_API_KEY`; **server key** restringida por IP solo en el backend → `GOOGLE_MAPS_API_KEY`. Verificar que `GET /api/config/maps` sirva la browser key (`MapsConfigController`).

---

## 4-bis. Alto (capa de datos)

Los cuatro siguientes son de la misma familia: **consultas calientes sin índice o sin límite, sobre tablas que solo crecen**. Todos son DDL o una query reescrita, sin cambio de contrato.

### A13 — El barrido de ofertas de insumos escanea toda la tabla cada 60 s
`SpringDataOfertaInsumoRepository.java:49-53` (en `ProgramadorExpiracionInsumo.java:26`, cada `app.insumos.barrido-ms` = 60 s, `application.properties:168`):
```sql
UPDATE oferta_insumo SET estado='EXPIRADA', resuelta_en=$1
WHERE estado='PENDIENTE' AND expira_en <= $1;
```
Los únicos índices de `oferta_insumo` son `requerimiento_id` y `proveedor_id` (`V1:251-252`); **no hay nada sobre `estado` ni `expira_en`** (`V1:211-221` solo define CHECKs). Además las filas `EXPIRADA/ACEPTADA/CANCELADA` nunca se purgan, y cada solicitud de insumos crea una oferta **por proveedor activo**. Resultado: *seq scan* de una tabla que crece con el uso, 1 440 veces al día.

**Fix:** `CREATE INDEX idx_oferta_insumo_pendiente_expira ON oferta_insumo (expira_en) WHERE estado = 'PENDIENTE';`

### A14 — `requerimiento_insumo_item`: FK sin índice y colección EAGER
`V1:202-209` crea la tabla y la FK **sin índice** en el lado referenciante. `RequerimientoInsumoJpaEntity.java:73-76` mapea `@OneToMany(fetch = EAGER)` con `@JoinColumn`, así que Hibernate emite `SELECT ... FROM requerimiento_insumo_item WHERE requerimiento_id = ?` **por cada solicitud cargada**, y cada una es un *seq scan* de la tabla hija. Se combina con el N+1 del poll del proveedor (M1).

**Fix:** `CREATE INDEX idx_req_insumo_item_req_id ON requerimiento_insumo_item (requerimiento_id);` y pasar la colección a `LAZY` con fetch join explícito.

### A15 — La limpieza de órdenes huérfanas carga toda la tabla `ot` cada 5 minutos
`LimpiarOrdenesHuerfanasUseCase.java:50-58` llama `otRepository.listarTodas()` (sin `WHERE`, sin límite), filtra en memoria los estados que le importan y después hace `findByIdAndActivoTrue` por candidata (`:73,:80`). Lo dispara `ProgramadorLimpiezaOrdenesHuerfanas.java:17` cada 300 000 ms.
Costo: hidratar y mapear **todas** las OTs históricas (incluidas `FINALIZADA`/`CANCELADA`, que descarta después) 288 veces al día.

**Fix:** una query acotada, p. ej. `WHERE estado IN (...5 estados con técnico...) AND (tecnico_id IS NULL OR NOT EXISTS (SELECT 1 FROM tecnico t WHERE t.id = ot.tecnico_id AND t.activo))`, idealmente con `(estado, tecnico_id)`. `(ya planificado: T5.3)`

### A16 — Doble asignación de un técnico (check-then-act sin condición)
`AceptarOfertaUseCase.java:88` lee el técnico, `:117-118` llama `tecnico.aceptarOrden()` (que valida `estadoOperativo == DISPONIBLE` **en memoria**, `Tecnico.java:136-144`) y guarda con `save`. `TecnicoJpaEntity` **no declara `@Version`** (solo `ot`, `requerimiento_insumo` y `oferta_insumo` lo tienen), y el `UPDATE` no lleva condición de estado.
La puerta atómica que existe es por OT (`asignarSiDisponible`), no por técnico: dos ofertas de **OTs distintas** aceptadas en paralelo por el mismo técnico leen `DISPONIBLE`, ambas escriben `OCUPADO` y el técnico queda con dos OTs. Lo mismo con `liberarOrden`/`desbloquear`.

Escenario de negocio: el técnico recibe dos ofertas simultáneas (el despacho las emite en ráfaga), acepta las dos por doble clic o por dos pestañas, y aparece en dos órdenes a la vez — con dos clientes esperando.

**Fix (sin migración):** `UPDATE tecnico SET estado_operativo='OCUPADO' WHERE id=:id AND estado_operativo='DISPONIBLE' AND estado_validacion='APROBADO'` y comprobar `== 1` antes de asignar; alternativamente `@Version` en `tecnico` + `V15`. `(ya planificado: T4.5)`

---

## 5. Medio

### M1 — N+1: el patrón está por todo el borde de lectura
`NombresOtResolver.java:78-92` memoiza por lote, pero cada cliente/técnico distinto cuesta 2 queries (`clienteRepository.buscarPorId` + `usuarioRepository.buscarPorId`, líneas 49-71). Un listado de 200 OTs de 200 clientes distintos = ~400 queries, y el memo no ayuda porque los ids son distintos. `OtController.conNombres` (`OtController.java:120-123`) repite 2 queries por respuesta unitaria.

El resto de la lista, verificado:
| Caso | Evidencia | Coste |
|---|---|---|
| Poll del proveedor: `buscarPorId(requerimiento)` por oferta | `ListarSolicitudesProveedorUseCase.java:56-61` | 1 + N queries, y cada una dispara el seq scan de A14 |
| Comprobantes: `buscarPorId(ot)` por liquidación | `VerificarComprobanteUseCase.java:96-105,115-117` | 1 + N (el comentario del código lo admite) |
| Disputas: `buscarPorId(ot)` por disputa | `GestionarDisputaUseCase.java:126-132` | 1 + N, pese a que `buscarPorIds` ya existe (`OtRepositoryAdapter.java:99-108`) |
| Liquidaciones del técnico | `ListarLiquidacionesTecnicoUseCase.java:44-47,54-55` | 1 + N |
| Radar: el adapter ya cargó los técnicos (`findAllById`) y el caso de uso los vuelve a pedir | `BuscarTecnicosCercanosUseCase.java:48-61` vs `PostgisTecnicoDisponibilidadAdapter.java:99-101` | 2N por request del radar |
| Listado de técnicos: usuario por técnico | `BuscarTecnicoUseCase.java:33,57` | 1 + N |
| Barrido documental: `buscarPorTecnico` en bucle | `VerificarVigenciaDocumentalUseCase.java:44,49` | 1 + N por día, con todos los técnicos en memoria |

**Fix:** `findAllById`/`findAllByUsuarioIdIn` en dos queries para cada lote; usar el `buscarPorIds` que ya existe en los cuatro casos de administración; y en el radar devolver los datos ya cargados (o resolver el join en la propia SQL). `(ya planificado: T6.2/T6.3)`

### M2 — FKs `NOT VALID` que nunca se validaron
`V2__agregar_foreign_keys_cross_modulo.sql:11-61`: las 18 FKs se añaden con `NOT VALID` (y `V7:45` repite el patrón con `ON DELETE SET NULL`). Eso solo evita validar filas existentes; PostgreSQL **no** las valida nunca después: cualquier huérfano previo sigue ahí y nada lo detecta. Tampoco se puede asumir integridad para los barridos ni para los reportes.
**Fix:** (1) pre-chequear huérfanos por constraint (`LEFT JOIN ... WHERE padre.id IS NULL`) y corregir/purgar; (2) `ALTER TABLE ... VALIDATE CONSTRAINT ...` una por una, fuera de Flyway, con `SET lock_timeout='5s'` en ventana de baja carga (toma `SHARE UPDATE EXCLUSIVE`: no bloquea DML normal, solo DDL). Después, decidir `RESTRICT` vs `SET NULL` por tabla. `(ya planificado: T9.3)`

### M3 — SSE sin topes
`SseEmitterRegistry.java:48-55`: `crear(key)` no limita emisores por clave ni por identidad; `SseTicketService.java:54-60`: el `Map` de tickets pendientes no tiene tope. Un usuario autenticado puede pedir tickets en bucle y abrir N streams (`emitter-timeout` = 30 min, `application.properties:181`), agotando heap y file descriptors. Además `limpiar()` está documentado como "used on shutdown" pero no hay `@PreDestroy`.
Escenario realista: una pestaña que reintenta en bucle por un bug de cliente (el propio `SseService` acota a 5 fallos, bien) o un script.
**Fix:** cap por clave (10) y por usuario, Caffeine para tickets, `@PreDestroy`. `(ya planificado: T8.1/T8.2)`

### M4 — Demo y mock dentro del bundle de producción
- `auth.service.ts:221` `switchDemoRole(rol)` y `auth.service.ts:120` `createMockJwt(...)`.
- `token-storage.service.ts:77,126` `createMockJwt` / `createMockJwtConRolAdicional`, usados por `clientes-api.ts:195` y `tecnicos-api.ts:108` para inventar un token al adquirir un segundo perfil.
- `MockDbService` se inyecta en servicios y páginas reales (`ot-api.ts:47`, `seguimiento-ot-page.ts:56`, `ot-carga.ts:16`, …), así que se empaqueta siempre, aunque `environment.useMocks=false` (`environment.ts:36`).

Los tokens mock **no** son una escalada real: van sin firma y el backend los rechaza (`JwtAuthenticationFilter.java:49-51`). Pero: (a) `switchDemoRole` es invocable desde la consola y deja la UI en modo admin con datos de demo (confusión y capturas falsas), (b) el bundle sirve nombres/teléfonos ficticios, y (c) se paga tamaño de descarga.
**Fix:** borrar `switchDemoRole` y el fallback a `createMockJwt`; mover `MockDbService` a un árbol no empaquetado o eliminarlo si ya nada real lo usa. `(ya planificado: T2.2)`

### M5 — La exclusión de Sonar apunta a una ruta inexistente: la API key real sí se publica
`frontend/sonar-project.properties:9,13` excluye `src/environments/maps-key.ts`, pero el archivo real es `src/app/core/environment/maps-key.ts` (generado, gitignored — correcto en git). Es decir, el análisis de Sonar **incluye** el archivo con la clave y la sube al servidor (`sonar.host.url=http://localhost:9000`, línea 4).
En disco hay credenciales reales que el repo ignora correctamente: `frontend/.env:3` (`GOOGLE_MAPS_API_KEY=AIza…`), `frontend/.env:6` (`SONAR_TOKEN=sqp_…`) y `backend/.env:6` (`RESEND_API=re_…`), replicadas en `maps-key.ts:3`. Verificado: `git check-ignore` las ignora y `git log -S` confirma que **nunca** estuvieron en el historial (455 commits, todas las ramas) — no hay que rotarlas por fuga en git, solo por higiene del equipo.
Dos agravantes:
- El análisis se envía a **`http://localhost:9000` en claro** (`build.gradle:11`, `sonar-project.properties:6`, `scripts/sonar.mjs:41,59-64`): cualquier proceso escuchando en ese puerto captura el token y el fuente. Y como ningún workflow invoca `sonar`, tampoco hay gate real.
- La key de Maps es la misma que usa el backend (ver A12).
**Fix:** corregir las dos rutas de exclusión; `sonar.host.url` desde entorno con **https obligatorio** y sin default localhost; rotar el `SONAR_TOKEN`; restringir la key de Maps por referrer + APIs (A12). `(ya planificado: T2.3)`

### M6 — CI sin escaneo de dependencias y acciones por tag
`.github/workflows/backend-ci.yml:40,44,48,54` y `frontend-ci.yml`: `actions/checkout@v4`, `setup-java@v4`, `setup-gradle@v4`, `upload-artifact@v4` — tags mutables, no SHAs. No hay `npm audit`, `dependency-check`, `dependency-review-action`, Dependabot ni CodeQL en ningún workflow.
**Fix:** fijar a SHA con comentario de versión, añadir `npm audit --audit-level=high`, `gradle dependency-check` o `actions/dependency-review-action` en PR, y `timeout-minutes`. `(ya planificado: T3.3)`

### M7 — El wrapper de Gradle y el backend no verifican sus dependencias
- `backend/gradle/wrapper/gradle-wrapper.properties` fija `gradle-9.7.1-bin.zip` sin `distributionSha256Sum`: un compromiso del host de distribuciones (o un MITM en CI) ejecuta código arbitrario con los permisos del runner.
- No existe `backend/gradle/verification-metadata.xml` ni ningún `dependencyLocking`, así que tampoco hay verificación de las dependencias Maven ya resueltas.
**Fix:** `distributionSha256Sum=<sha256 oficial>`; `./gradlew --write-verification-metadata sha256 help` y `dependencyLocking { lockAllConfigurations() }`.

### M8 — Manifiesto Android permisivo (y no versionado)
`frontend/android/app/src/main/AndroidManifest.xml:4-6`: `android:usesCleartextTraffic="true"` y `android:allowBackup="true"`, hardcodeados. La config de Capacitor intenta condicionar cleartext por entorno (`capacitor.config.ts:12-21`), pero el manifiesto lo permite globalmente: cualquier recurso `http://` cargado en el WebView es aceptado, y un atacante en la red puede inyectarlo. `allowBackup` permite extraer el `localStorage` del WebView (donde vive el JWT) con `adb backup` en dispositivos que lo permitan.
**Fix:** `usesCleartextTraffic="false"` + `network_security_config.xml` con excepción solo para `10.0.2.2`/localhost en debug; `allowBackup="false"` o reglas de backup que excluyan el storage del WebView. **Ojo:** `frontend/android/` no está versionado (ver B16), así que el fix no persiste hasta versionarlo.

### M9 — Un build de producción sin `API_ORIGIN` se genera "verde" y falla entero en runtime
`frontend/scripts/generate-api-origin.mjs:22,37,52,107`: si `API_ORIGIN` no está, el default es `''` y el build sigue. `api.config.ts:50-62` compondría `/api/...` relativo, y `vercel.json:7` excluye explícitamente `/api/` del rewrite al SPA, así que **todas** las llamadas devuelven 404 del hosting. Es el típico "el deploy quedó verde y la app no carga datos".
**Fix:** si `NODE_ENV==='production'` o `CI` y `API_ORIGIN` está vacío, `process.exit(1)` con mensaje claro; permisivo solo para `ng serve`. `(ya planificado: T3.1)`

### M10 — Enumeración de cuentas: el 409 de registro devuelve el correo y delata el rol
`CorreoDuplicadoException.java:8` arma el mensaje `"Correo duplicado: <correo>"`, y cuatro advices lo devuelven tal cual con 409 (`UsuarioControllerAdvice.java:33-36`, `ClienteControllerAdvice.java:52-54`, `TecnicoControllerAdvice.java:63-65`, `ProveedorControllerAdvice.java:65-68`). Los cuatro endpoints son públicos (`SecurityConfig.java:86-88`) y el disparo es `existeCorreo` (`RegistrarUsuarioUseCase.java:34`, `RegistrarClienteUseCase.java:51`, `RegistrarTecnicoUseCase.java:44`, `RegistrarProveedorUseCase.java:52`).
Un solo POST confirma si la cuenta existe, sin ruido de tiempos; y probando los cuatro endpoints se infiere **el rol** (201 en `/api/tecnicos` ⇒ es o puede ser técnico). Eso alimenta el phishing dirigido y el credential stuffing de A1/A2.
**Fix:** respuesta uniforme (202) y resultado real por correo; nunca devolver el correo en el mensaje. `(ya planificado: T7.3, requiere decisión de producto)`

### M11 — Oráculo de timing en el login
`AutenticarUsuarioUseCase.java:35-36`: si el correo no existe, lanza sin más; si existe, ejecuta bcrypt costo 12 (~200-400 ms, `PasswordEncoderAdapter.java:15-17`). El mensaje es idéntico (correcto), el tiempo no.
Promediando unas decenas de peticiones desde una IP (dentro del cupo de 10/min) se separa "existe" de "no existe" con alta confianza.
**Fix:** cuando el correo no resuelva, ejecutar `passwordEncoder.matches(passwordPlano, HASH_DUMMY)` con un hash fijo de costo 12 y luego lanzar la misma excepción. `(ya planificado: T7.3)`

### M12 — Controles demo en producción que fabrican evidencia
Tres caminos de demo quedaron en el build real:
- `solicitar-servicio-page.html:206-212` → botón "Cargar Foto Demo" que inserta una URL de Unsplash como `evidenciaUrl` y avisa "Se adjuntó fotografía de evidencia" (`solicitar-servicio-page.ts:162-167`).
- `perfil-documentos-page.ts:32` prellena `archivoUrl` con `https://coldday.com.co/docs/certificacion.pdf` (documento que no existe) y se envía tal cual (`perfil-documentos-page.html:120`): un técnico se "acredita" sin subir nada.
- `mapa-radar.html:344-352` expone `simularExpansionRadio` (+X km), que altera el radio del radar en el cliente.

El botón es solo la punta: como **el backend no valida que la URL de evidencia sea un recurso subido**, cualquiera puede mandar cualquier URL por API. Eso impacta disputas y acreditación de técnicos (controles de confianza), no solo la UI.
**Fix:** borrar los tres caminos demo y, sobre todo, validar en servidor que las evidencias/documentos sean recursos propios (upload con id) o al menos URLs de un bucket propio. Requiere upload real, hoy no existe.

### M13 — Los guards deciden el rol con claims sin verificar y sin comprobar la expiración
`role.guard.ts:13-20` y `auth.guard.ts:11` autorizan con `tokenStorage.getDecodedToken()` / `authService.userRoles()`, es decir con los **claims decodificados sin verificar firma**, y `auth.guard` no mira `exp` (la expiración solo se aplica al restaurar sesión, `auth.service.ts:55-60`).
Un JWT pegado a mano en `localStorage` con `rol: "ADMINISTRADOR"` entra a `/admin/**`. No hay robo de datos —el backend valida de verdad (`SecurityConfig.java:86-100`, `@PreAuthorize`, `OtController.java:137-142`)— pero toda la UI administrativa queda expuesta y la seguridad pasa a depender de que ningún endpoint futuro olvide el check.
**Fix:** tratar el claim solo como *hint* de navegación, alimentar roles desde la respuesta autenticada del servidor (`/api/usuarios/me`), y que el 401/403 del backend sea la única autoridad.

### M14 — El artefacto que corre en producción no pasa por los tests
`Dockerfile:16`: `./gradlew --no-daemon clean bootJar -x test`; `render.yaml:7-12` con `autoDeploy: true` y `runtime: docker`. Render construye la imagen él mismo, así que la suite de CI (con Testcontainers) **no condiciona** lo que se despliega: un push a `main` con tests rojos igual publica.
**Fix:** quitar `-x test` del Dockerfile (o un stage `check`), y que `autoDeploy` dependa del check de CI (Render permite desactivar auto-deploy y desplegar tras el check).

### M15 — PII en los logs de producción
Con `MAIL_ENABLED=false` por defecto (`application-prod.properties:101`), el notificador de respaldo escribe `usuarioId` **y el correo** a nivel INFO (`LoggingNotificadorRecuperacion.java:43`). En dev además se loguea el token en claro (`:38`, `application-dev.properties:65`), lo cual está bien acotado; en prod está forzado a `false` (`application-prod.properties:106`), correcto.
**Fix:** bajar ese log a DEBUG y no incluir el correo (o enmascararlo).

### M16 — El rate limit es evadible por `X-Forwarded-For` si el 8090 se expone directo
`application-prod.properties:41` fija `server.forward-headers-strategy=NATIVE`, que activa `RemoteIpValve` en Tomcat: `getRemoteAddr()` pasa a ser el valor del header `X-Forwarded-For` **cuando la conexión viene de una IP interna** (10/8, 172.16/12, 192.168/16, 127/8). `RateLimitFilter.java:105` usa exactamente `getRemoteAddr()` como clave.
En Render el proxy es el único que llega al puerto, así que es correcto. Pero `docker-compose.yml:42` publica `8090:8090` en `0.0.0.0`: con la app activa en perfil prod, cualquiera en la LAN llega desde una IP interna y puede rotar `X-Forwarded-For` para tener un bucket nuevo por petición. `(ya planificado: T7.1)`
**Fix:** en compose, perfil `dev` y bind `127.0.0.1:8090:8090`; fuera de Render, `FORWARD_HEADERS_STRATEGY=NONE`; y si se despliega detrás de un proxy propio, `server.tomcat.remoteip.internal-proxies` al CIDR exacto.

---

## 6. Bajo

- **B1 — Guards cosméticos.** `app.routes.ts:60-86`: las cinco rutas `cliente/ot/*` y `cliente/equipos` solo tienen `authGuard`, sin `roleGuard(['CLIENTE','TECNICO','ADMINISTRADOR'])`. El backend responde 403 igual, pero un PROVEEDOR ve una pantalla rota. `(ya planificado: T2.4)`
- **B2 — Carrera y scan completo en el código de OT.** `OtRepositoryAdapter.java:42-47,163-168` calcula `MAX(split_part(codigo,'-',3)) WHERE codigo LIKE 'OT-'||:anio||'-%'`. `idx_ot_codigo` (`V14:46`) **no puede** servirla: `MAX` sobre una expresión no usa el btree, y el `LIKE` de prefijo con colación no-C tampoco. Resultado: scan completo de `ot` en **cada** creación. Además dos creaciones concurrentes del mismo año calculan el mismo número y la perdedora falla contra el índice único (el propio código lo admite como "shortcut").
  **Fix:** tabla `ot_secuencia_anio` con `INSERT ... ON CONFLICT ... RETURNING` (elimina carrera y scan, ver §7); alternativa mínima, `pg_advisory_xact_lock(hashtext('ot_codigo'))` antes del `MAX`.
- **B3 — Constraints de negocio ausentes.** Faltan: `CHECK (auxiliares_requeridos >= 0)`; unicidad de oferta pendiente por `(ot_id, tecnico_id)` (`IniciarBusquedaTecnicoUseCase.java:85-95` inserta sin guarda); y unicidad de disputa abierta por OT (`GestionarDisputaUseCase.java:79-84` hace check-then-act sobre una tabla sin `UNIQUE(ot_id)`, `V1:162-171`, y `DisputaJpaEntity` no tiene `@Version`). Con la ventana de concurrencia real (doble clic, reintento, varias instancias) quedan dos ofertas PENDIENTES al mismo técnico o dos disputas ABIERTAS para la misma OT.
  **Fix:** los índices únicos parciales de §7. `(ya planificado: T9.2)`
- **B4 — Oráculo de estado de OT (409 antes de 403).** `CancelarOtUseCase.java:80-85` valida la transición (`TransicionesOt.validar`) **antes** de resolver el actor (`:116-143`, donde se comprueba la propiedad). Con un UUID de OT ajena, un usuario autenticado recibe 409 si la orden no es cancelable y 403 si lo es: confirma existencia y estado de órdenes de otros sin ser participante.
  **Fix:** autorizar primero, validar la transición después.
- **B5 — Proxy de Google Maps sin cupo.** `MapsController.java:42` exige solo `isAuthenticated()` y `/api/maps/**` no está en `RUTAS_LIMITADAS` (`RateLimitFilter.java:69-73`). Con autoregistro público, cualquier cuenta consume Geocoding/Directions con la server key facturada al titular.
  **Fix:** cupo por usuario en `/api/maps/**` (y valorar restringirlo a `CLIENTE`/`TECNICO` en flujo de OT).
- **B6 — `environment.backendUrl: 'http://localhost:8090'`** (`environment.ts:27`) se empaqueta pero solo lo documenta `proxy.conf.json`; ningún código lo lee (`grep backendUrl` solo lo encuentra ahí). Es config muerta que confunde.
- **B7 — Perfil fantasma `postgres`.** `backend/src/main/resources/` solo tiene `application.properties`, `-dev` y `-prod`; sin embargo `render.yaml:15` y `docker-compose.yml:32` activan `prod,postgres`. Hoy es un no-op que confunde los comentarios de ambos archivos; el único rastro del perfil que existió es el artefacto IDE obsoleto `out/production/.../application-postgres.properties:8` (untracked, gitignored), que todavía lleva `password=${POSTGRES_PASSWORD:cold_day}`.
  **Fix:** borrar `out/`, y crear el perfil de verdad o quitar `postgres` de ambos configs.
- **B8 — `backend/local.properties` está *staged* y se commiteará en el próximo commit.** `git ls-tree HEAD` y `git log --all` no lo tienen (no está versionado todavía), pero `git status` lo muestra como `A` y `git check-ignore` no lo cubre: `backend/.gitignore` solo ignora `.env`. Contiene `sdk.dir=C:\Users\SENA\AppData\Local\Android\Sdk` (`:8`), publica la ruta y el nombre de usuario del desarrollador y no aporta nada al build de este backend.
  **Fix:** `git rm --cached backend/local.properties` + añadirlo a `backend/.gitignore`.
- **B9 — `docker-compose.yml` publica Postgres y el backend en todas las interfaces, en perfil prod y con el JWT de desarrollo.** `:32` activa `prod,postgres`; `:29-30` lee `backend/.env`, cuyo `JWT_SECRET` es el literal público de `application-dev.properties:27`; `:42` publica `8090:8090` y `:10` publica `5433:5432` (bind `0.0.0.0`) con la password fija `cold_day` (`:8`). Cualquiera en la LAN forja JWTs de `ADMINISTRADOR` contra el 8090 y lee/escribe la base. Además el `env_file` es medio decorativo: `environment` (`:38-40`) pisa los `POSTGRES_*`, al revés de lo que dice el comentario `:27-28`.
  **Fix:** compose solo con perfil `dev`, bind `127.0.0.1:5433:5432` y `127.0.0.1:8090:8090`, `JWT_SECRET` distinto y fuera del repo.
- **B10 — El token de recuperación viaja en la query string.** `MailProperties.java:55-58` construye `...recuperar?token=...`: queda en historiales, logs de proxy y `Referer` de recursos de terceros de esa página. Un solo uso + 30 min baja el impacto.
  **Fix:** moverlo al fragmento (`#token=`) o a un POST de un solo paso. `(ya planificado: T8.3)`
- **B11 — `proxy.conf.json` desactualizado.** `frontend/proxy.conf.json:1-56` solo cubre nueve prefijos; el código llama `/api/config/maps` (`mapa-config.service.ts:111`), `/api/sse/ticket` (`sse.service.ts:292`), `/api/proveedores` y `/api/insumos` (`proveedores-api.ts:60,73,88,131,144,154,167`). En `ng serve` esas rutas las atiende el dev-server: SSE muerto, portal de proveedores roto y config de mapas en fallback.
  **Fix:** un catch-all `"/api"` en `proxy.conf.json` y `proxy.local.json`. `(ya planificado: T3.4)`
- **B12 — Logout incompleto.** `auth.service.ts:195-204` borra token y `CLAVE_COMPARTIR_UBICACION`, pero quedan el borrador de solicitud con dirección/descripción/evidencia (`solicitud-draft.service.ts:25,35`), el registro de proveedor (`proveedor-registro.service.ts:43`), el panel preferido (`panel-resolver.ts:7`) y el layout (`layout.service.ts:72`). En equipo compartido, el siguiente usuario los lee por devtools.
  **Fix:** limpiar en logout las claves de sesión y no persistir PII en `sessionStorage`.
- **B13 — La sesión no muestra nombre.** El JWT real no trae `nombre` (`auth.service.ts:56-69,159-160` lo deja `''`) y `login-page.ts:55` compone `Sesión iniciada como ${usuario.nombre}` → toast "Sesión iniciada como ".
  **Fix:** usar el correo como fallback o añadir `GET /api/usuarios/me`.
- **B14 — Dependencias declaradas y sin uso + metadata de AI Studio.** `@google/genai ^2.4.0` (`package.json:47`) no tiene un solo import en `src` ni `projects`; `motion ^12.23.24` (`:52`) tampoco; `@capacitor/preferences ^8.0.1` (`:46`) solo aparece en el JSON de plugins de Android; `@angular/cdk` (`:34`) sin import directo; `@types/google.maps` está en `dependencies` en vez de `devDependencies` (`:50`). Y `frontend/metadata.json:5` declara `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`.
  **Fix:** quitar lo no usado, mover tipos a dev, borrar `metadata.json`.
- **B15 — `landing/script.js` con `APP_URL` placeholder.** `landing/script.js:10` → `https://app.coldday.com.co` (con `TODO` en `:7`) llena todos los CTA `[data-app]`: si el dominio real es otro, los botones llevan a un host inexistente. El formulario B2B solo arma un `mailto` (`:85-90`), así que el lead se pierde si el usuario no envía el correo.
  **Fix:** URL por entorno y endpoint real (o un servicio de formularios).
- **B16 — La plataforma `frontend/android/` no está versionada.** `git ls-files frontend/android` no devuelve nada, así que M8 (endurecer el manifiesto) se pierde al regenerar la plataforma; además quedan restos legacy: `frontend/android/app/src/main/res/xml/config.xml:3` con `<access origin="*" />` y el `capacitor.config.json` generado con `cleartext` + `allowMixedContent` pese a que `capacitor.config.ts:13` lo condiciona a `CAP_DEV_HTTP`.
  **Fix:** versionar `android/` (sin `local.properties`), fijar `network_security_config` solo para localhost y regenerar la config.
- **B17 — `springdoc-openapi 2.8.5` contra Spring Boot 4.1.1.** `build.gradle:40` resuelve springdoc 2.8.5, que es la línea de Boot 3.x. Con Boot 4 el autoconfiguration cambia: el riesgo real es que `/v3/api-docs` y Swagger queden deshabilitados en silencio (en prod ya están apagados, `application-prod.properties:71-72`, así que solo afecta a dev y a la documentación).
  **Fix:** springdoc 3.x para Boot 4, o fijar la versión y añadir un smoke test de `/v3/api-docs` en el perfil dev.
- **B18 — Imágenes base por tag mutable.** `Dockerfile:1,4,20`: `docker/dockerfile:1`, `eclipse-temurin:25-jdk`, `eclipse-temurin:25-jre`. Un rebuild no es reproducible ni auditable.
  **Fix:** fijar por digest (`@sha256:…`).
- **B19 — `.dockerignore` incompleto.** `backend/.dockerignore:1-12` excluye `build`, `.gradle`, `.env`, `docs`… pero no `local.properties` (que entra al build context que Render sube al builder; el Dockerfile no hace `COPY .`, así que no acaba en la imagen).
  **Fix:** añadir `local.properties` y `.env*`.
- **B20 — Node 20 (EOL) permitido.** `frontend/package.json:30` permite `^20.19.0` mientras el CI usa Node 22 (`frontend-ci.yml:30`).
  **Fix:** `">=22.12.0"`.

---

## 7. Arquitectura de datos: consultas reales vs índices

Mapa de los caminos calientes, la query que ejecutan y el veredicto. (Los 17 índices de `@Table(indexes=…)` de V1 se asumen existentes en producción porque los creó Hibernate; el resto, no.)

| Camino | Query real | Índice que la sirve | Veredicto |
|---|---|---|---|
| Login | `usuario WHERE correo = ?` | `uk_usuario_correo_activo` **con** `WHERE activo` | ❌ seq scan (A8) |
| JWT por request | `usuario WHERE id = ?` | PK | ✅ (pero es 1 query extra por request) |
| Radar de técnicos | PostGIS `ST_DWithin` + `ORDER BY distance` | GiST parcial, **solo en V1** | ❌ probablemente ausente en prod (A7) |
| Barrido despacho (cada 5 s) | `ot WHERE estado=? AND ventana_expira_en <= ?` | `idx_ot_estado` (solo estado) | ⚠️ usa el de estado y filtra la fecha en heap (A9) |
| Barrido de ofertas de insumos (cada 60 s) | `oferta_insumo WHERE estado='PENDIENTE' AND expira_en <= ?` | **ninguno** (`V1:251-252` solo cubre req/proveedor) | ❌ seq scan de toda la tabla, 1 440 veces/día (A13) |
| Barrido de solicitudes de insumos | `requerimiento_insumo WHERE estado='SOLICITADO' AND expira_en <= ?` | `idx_req_insumo_estado` | ⚠️ parcial pero aceptable |
| Barrido vigencia documental (diario) | 1 query por técnico (`findByActivoTrue` + `buscarPorTecnico` en bucle, `VerificarVigenciaDocumentalUseCase.java:44,49`) | `idx_documento_tecnico_tecnico_id` sirve cada query; `activo` no está indexado | ❌ N+1: 1+N queries y todos los técnicos en memoria (M1) |
| Limpieza de huérfanas (cada 5 min) | `SELECT * FROM ot` sin WHERE | PK (sin valor) | ❌ tabla completa hidratada 288 veces/día (A15) |
| Listado cliente | `ot WHERE cliente_id = ?` (sin ORDER BY) | `idx_ot_cliente_id` | ✅ filtro; falta orden determinista y límite |
| Listado técnico | `ot WHERE tecnico_id = ?` (sin ORDER BY) | `idx_ot_tecnico_id` | ✅ ídem |
| Bandeja de ofertas del técnico | `oferta_ot WHERE tecnico_id=? AND estado IN (…)` | `idx_oferta_ot_tecnico_id` | ⚠️ trae todo el histórico del técnico y filtra estado en heap |
| Insumos por técnico | `requerimiento_insumo WHERE tecnico_id = ?` | **ninguno** | ❌ seq scan (`V1:248-249` solo indexa `ot_id` y `estado`) |
| Ítems de una solicitud (EAGER) | `requerimiento_insumo_item WHERE requerimiento_id = ?` | **ninguno** (hay FK, `V1:207-209`) | ❌ seq scan por cada solicitud cargada (A14) |
| Calificaciones por técnico | `ot WHERE calificacion_tecnico_id = ?` | **ninguno** (FK en `V7:44-45`) | ❌ seq scan, y `ON DELETE SET NULL` lo usa al tocar un técnico |
| Historial | `ot_estado_historial WHERE ot_id=? ORDER BY ocurrido_en, id` | `idx_ot_estado_historial_ot_id` | ✅ (sort pequeño) |
| Tablero admin | 10 × `ot WHERE estado=?` + `findAll` liquidaciones/técnicos | `idx_ot_estado` (sí se usa) | ⚠️ el defecto no es el índice, es hidratar todo en JVM (A6) |
| listarTodas admin | `findAll` sin `Sort` | PK | ⚠️ sin orden determinista ni paginación (A6) |
| `token_recuperacion` | `WHERE token_hash=?` / `WHERE usuario_id=? AND usado=false` | UNIQUE de `V1:83` + `idx_..._usuario_id` (`V1:244`) | ✅ |
| Código OT por año | `MAX(split_part(codigo,'-',3)) WHERE codigo LIKE 'OT-<anio>-%'` | `idx_ot_codigo` **no aplica**: `MAX` sobre expresión + `LIKE` con colación no-C | ❌ scan completo de `ot` por cada creación (B2) |

**FKs sin índice de soporte (revisadas una a una):** solo faltan **tres** de las 18: `requerimiento_insumo.tecnico_id` (`V2:54-55`), `ot.calificacion_tecnico_id` (`V7:44-45`) y `requerimiento_insumo_item.requerimiento_id` (`V1:207-208`). Las demás están cubiertas por los UNIQUE de V1 (`tecnico.usuario_id`, `clientes.usuario_id`, `proveedor.usuario_id`, `liquidacion.ot_id`) y por `idx_*` de V1/V9.

**Migración propuesta (aditiva, `V15__indices_calientes.sql`):**

```sql
-- Barridos
CREATE INDEX IF NOT EXISTS idx_ot_buscando_ventana
  ON ot (ventana_expira_en) WHERE estado = 'BUSCANDO_TECNICO';
CREATE INDEX IF NOT EXISTS idx_oferta_insumo_pendiente_expira
  ON oferta_insumo (expira_en) WHERE estado = 'PENDIENTE';
CREATE INDEX IF NOT EXISTS idx_req_insumo_solicitado_expira
  ON requerimiento_insumo (expira_en) WHERE estado = 'SOLICITADO';
-- Barridos (el de documentos solo sirve si M1 se reescribe a una sola query)
CREATE INDEX IF NOT EXISTS idx_documento_tecnico_vencimiento
  ON documento_tecnico (fecha_vencimiento);

-- Listados con orden
CREATE INDEX IF NOT EXISTS idx_ot_cliente_creada ON ot (cliente_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_ot_tecnico_creada ON ot (tecnico_id, creada_en DESC);

-- FKs sin índice en el lado referenciante
CREATE INDEX IF NOT EXISTS idx_req_insumo_tecnico ON requerimiento_insumo (tecnico_id);
CREATE INDEX IF NOT EXISTS idx_req_insumo_item_req ON requerimiento_insumo_item (requerimiento_id);
CREATE INDEX IF NOT EXISTS idx_ot_calificacion_tecnico ON ot (calificacion_tecnico_id);

-- Bandeja de ofertas
CREATE INDEX IF NOT EXISTS idx_oferta_ot_tecnico_estado ON oferta_ot (tecnico_id, estado);
CREATE INDEX IF NOT EXISTS idx_oferta_insumo_proveedor_estado ON oferta_insumo (proveedor_id, estado);

-- Login alineado con el soft-delete
CREATE INDEX IF NOT EXISTS idx_usuario_correo ON usuario (correo);

-- Unicidad que hoy solo se garantiza en memoria
CREATE UNIQUE INDEX IF NOT EXISTS uk_disputa_abierta_por_ot
  ON disputa (ot_id) WHERE estado = 'ABIERTA';
CREATE UNIQUE INDEX IF NOT EXISTS uk_oferta_ot_pendiente_unica
  ON oferta_ot (ot_id, tecnico_id) WHERE estado = 'PENDIENTE';
```

Y lo que **no** es un índice, pero resuelve las dos carreras de negocio:

```sql
-- B2: elimina la carrera y el scan por creación de OT
CREATE TABLE IF NOT EXISTS ot_secuencia_anio (anio integer PRIMARY KEY, ultimo integer NOT NULL DEFAULT 0);
-- uso: INSERT ... ON CONFLICT (anio) DO UPDATE SET ultimo = ot_secuencia_anio.ultimo + 1 RETURNING ultimo;
```

```java
// A16: la puerta atómica del técnico (sin migración)
@Modifying
@Query("UPDATE TecnicoJpaEntity t SET t.estadoOperativo = :ocupado "
     + "WHERE t.id = :id AND t.estadoOperativo = :disponible AND t.estadoValidacion = :aprobado")
int ocuparSiDisponible(...);   // comprobar == 1 antes de asignar
```

Notas: `CREATE INDEX CONCURRENTLY` no puede correr dentro de la transacción de Flyway; usar una migración separada con `spring.flyway.mixed=true`, o aceptar el lock corto en una tabla pequeña. Antes de crear, verificar contra la base real el inventario (`pg_indexes`) — es exactamente la tarea `W0` del plan:

```sql
-- ¿Existe el índice espacial? (si no aparece, A7 está activo en producción)
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'tecnico';

-- ¿Qué índices tienen realmente las tablas calientes?
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('ot','oferta_ot','requerimiento_insumo','requerimiento_insumo_item',
                    'oferta_insumo','documento_tecnico','usuario','liquidacion')
ORDER BY tablename, indexname;

-- Huérfanos que impiden validar las FKs de V2 (M2)
SELECT count(*) FROM ot o
WHERE NOT EXISTS (SELECT 1 FROM clientes c WHERE c.id = o.cliente_id);
-- repetir por cada FK antes de VALIDATE CONSTRAINT
```

---

## 8. Matriz de ataques comunes

| Ataque | ¿Aplica? | Resultado verificado |
|---|---|---|
| Bypass de autenticación | **Sí, condicional** | Con perfil `dev` o sin perfil: admin total (C1) |
| Falsificación de JWT | **Sí, condicional** | Con el secreto del `.env.example`: admin total (C2) |
| IDOR / BOLA | No | 78 endpoints revisados: ninguno acepta `clienteId`/`tecnicoId`/`usuarioId` desde path o body; todos resuelven la identidad del principal y comparan contra la fila (`AutorizacionPropietario`) |
| SQL injection | No | JPQL/nativo parametrizado; hay `InyeccionSqlApiIT` |
| XSS almacenado/reflejado | No encontrado | Cero sinks en `frontend/src`, `projects/mobile` y `landing`: sin `innerHTML`, `bypassSecurityTrust*`, `DomSanitizer`, `eval`, `new Function`, `document.write`, `srcdoc`. El único `<script>` dinámico es el loader de Google Maps con URL fija (`google-maps-loader.ts:187-217`) |
| Fabricación de evidencia | **Sí** | Controles demo en el build + URLs de evidencia sin validar en servidor (M12) |
| Gate de rol solo en cliente | **Sí, pero sin impacto de datos** | Claims sin verificar en `role.guard.ts:13-20`; el backend revalida todo (M13) |
| CSRF | No | Stateless + Bearer en header, sin cookies (`SecurityConfig.java:53-57`) |
| Clickjacking | **Sí** | Sin `X-Frame-Options`/CSP `frame-ancestors` (A11) |
| Fuerza bruta de login | **Parcial** | 10/min por IP y ruta, sin dimensión de cuenta (A2) |
| Credential stuffing | **Sí** | Sin política de password ni bloqueo por cuenta (A1/A2) |
| Enumeración de usuarios | **Sí** | 409 con el correo en el mensaje, y el rol se infiere por endpoint (M10); login por timing (M11) |
| DoS por CPU (bcrypt) | **Sí** | Registro público sin cupo, costo 12 (A2) |
| DoS por memoria (SSE) | **Sí (autenticado)** | Sin topes en registry ni tickets (M3) |
| Fuga de credenciales en errores | **Sí** | Server key de Maps en 502 (A3) |
| Fuga de PII | **Sí** | GPS exacto + teléfono de técnicos (A4) |
| SSRF | No | Ningún endpoint hace fetch de URLs del usuario (solo Google con host fijo) |
| Mass assignment | No | Records sin campos derivables; rol forzado en servidor |
| Escalada por rol en el body | No | Bloqueado en los cuatro registros |
| Path traversal / subida de archivos | No | No hay subida de archivos (solo URLs de texto) |
| Open redirect | No | `normalizarReturnUrl` en `agregar-perfil-page.ts:32,72-73` |
| Ataque de dependencias (supply chain) | **Sí** | Sin escaneo, actions por tag, wrapper sin checksum (M6/M7) |

---

## 9. Plan de acción sugerido

**Ola 1 — cierra lo que puede tumbar el sistema (1 PR, ~60 líneas):**
C1 (perfil fail-closed + guard del bypass), C2 (guard del secreto dev + `.env.example`), A3 (mensaje de error de Maps), A5 (`orElse(false)` + `isActivo` + bump), A12/A10 (keys de Maps + `render.yaml`).

**Ola 2 — abuso y autenticación (1 PR, ~150 líneas):**
A1 (`@Size` en 5 records + dominio), A2 (rutas y clave por cuenta), M11 (bcrypt dummy en login), M10 (respuesta uniforme en registro), M3 (topes SSE + `@PreDestroy`), M16 (XFF solo detrás del proxy), B5 (cupo en `/api/maps`).

**Ola 3 — datos y capacidad (2-3 PR):**
`V15` de índices (A7/A8/A13/A14 + tabla de §7), A6 (agregados SQL + paginación), A15 (query acotada de huérfanas), M1 (batch/N+1), M2 (validar FKs), B3 (índices únicos de negocio). Verificar el inventario contra la base real antes de crear.

**Ola 4 — concurrencia (1 PR, el más delicado):**
A9 (lost update de OT) + A16 (técnico en dos OTs) + B2 (secuencia de códigos), con el test que reproduce cada carrera **antes** del fix. `(ya planificado: T4.1–T4.6)`

**Ola 5 — frontend, PII y supply chain:**
A4 (quitar GPS), A11 (headers/CSP), M12 (borrar demo + validar evidencias), M13 (roles desde el servidor), M4 (borrar mock), M5 (Sonar + restringir/rotar keys), M6/M7 (CI), M8/B16 (Android), M9 (`API_ORIGIN` obligatorio), B8/B11 (higiene de repo y proxy).

**Decisiones de producto que hay que tomar (no son técnicas):**
- token en cookie `httpOnly` vs `localStorage` (cambia el contrato de API);
- qué hacer con el 409 de registro (UX útil vs enumeración);
- si `/api/tecnicos/cercanos` debe mostrar teléfono antes de que exista una OT.

---

## 10. Anexo A: falsos positivos comprobados (no "arreglar")

- **`csrf().disable()`** (`SecurityConfig.java:56`): correcto, no hay cookies ni sesión.
- **Los `.env` no están en git**: `git ls-files` no los lista y `.gitignore:9-12` los cubre. La API key de Maps tampoco está trackeada; el problema es el servidor Sonar (M5) y que se usa como server key (A12), no git.
- **`spring.flyway.baseline-on-migrate=true`**: decisión consciente y documentada en `V1:8-13`; el defecto no es el baseline, es no haber creado después el índice que V1 aporta (A7).
- **Tickets SSE en query string**: es la única forma con `EventSource`; el ticket es de un solo uso, 30 s y hasheado. El riesgo residual (access log) ya está en T8.3 y es menor.
- **`Refresh`/rotación de token ausente**: no hay refresh token por diseño (`auth.service.ts:88-91`), el usuario re-loguea. Es una decisión, no un bug.
- **`mongodb`/`NoSQL` injection**: no aplica, el stack es Postgres/JPA.
- **`DevDataSeeder` con password conocida**: está apagado en prod (`application-prod.properties:78`) y hay test por perfil. Residual: `application.properties:189` mantiene el default `demo1234` aunque `odd/tasks/hardening-seguridad-confiabilidad.md:119` dice que se eliminó; solo importa si alguien activa `APP_SEED_ENABLED=true` en prod sin definir `APP_SEED_DEMO_PASSWORD`. El riesgo principal sigue siendo C1 (arrancar en dev sin querer), no el seeder.
- **El `save` que re-lee la fila no es por sí mismo un error**: es el patrón de actualización de los adapters; el defecto es que no compara versión (A9).

## 11. Anexo B: verificado limpio (con evidencia)

Para que no se gaste tiempo "arreglando" lo que ya está bien:

| Área | Qué se verificó |
|---|---|
| IDOR | 78 endpoints, uno a uno: ninguno acepta un id de propiedad desde path/body para actuar como otro; todos comparan contra el principal |
| SQLi | Todas las queries parametrizadas; existe `InyeccionSqlApiIT` |
| XSS | Cero sinks en `frontend/src`, `projects/mobile` y `landing`: sin `innerHTML`, `bypassSecurityTrust*`, `DomSanitizer`, `eval`, `new Function`, `document.write`, `srcdoc`, `insertAdjacentHTML`. El único `<script>` dinámico es el loader de Google Maps con URL fija (`google-maps-loader.ts:187-217`) |
| Mass assignment | 33 records de request sin `rol`/`estado`/`activo`/`id` derivables; el rol se fija en servidor |
| SSE | Ticket de 256 bits, SHA-256 en reposo, `remove` antes de validar, TTL 30 s, identidad contrastada con el recurso en los tres canales |
| Reset de contraseña | 256 bits, hash en reposo, un solo uso + invalidación global, 30 min, 202 no enumerante, con rate limit |
| CORS/CSRF | Orígenes exactos, `allowCredentials(false)`, `STATELESS`, CSRF deshabilitado con justificación válida |
| CI | Sin `pull_request_target`, sin `${{ secrets.* }}` en `run`, `permissions: contents: read`, SHAs de PR por `env:` (sin script injection) |
| Secretos en archivos trackeados | Escaneo de patrones (`AIza`, `re_`, `sqp_`, `AKIA`, `ghp_`, `sk-`, `xoxb-`, clave privada, `jdbc:...password`) sobre todo el árbol: **cero** en archivos trackeados; solo falsos positivos en `node_modules` y las credenciales de dev documentadas |
| `.env` en la imagen | El Dockerfile no hace `COPY .` y `.dockerignore:9` lo excluye; `spring.config.import=optional:file:.env` no encuentra archivo en `/app` |
| Configs de proxy en el bundle | `proxy.conf.json`/`proxy.local.json` solo los referencia el target `serve` (`angular.json:62,153`); los assets solo copian `public` |
| CVEs | Sin rangos vulnerables verificables en los artefactos resueltos (Boot 4.1.1, springdoc 2.8.5, jjwt 0.12.6, pgjdbc 42.7.13, flyway 12.4.0, caffeine 3.2.4, testcontainers 2.0.5, Angular 21). El riesgo es la **ausencia de escaneo** (M6), no una CVE concreta |
| Load tests | Solo `load-tests/results/*.txt`, sin credenciales ni URLs; el directorio está ignorado. Gap: los escenarios k6 no están en el repo |

**Cobertura de esta auditoría:** análisis estático (código, migraciones, configuración, historial de git) con verificación cruzada de cada hallazgo contra `archivo:línea`. No se ejecutó la aplicación ni se hicieron pruebas dinámicas contra un entorno desplegado; los dos hallazgos marcados "verificar en prod" (A7 y el inventario de índices de §7) requieren una conexión a la base real.

---

## 12. Estado de implementación

| Ola | Estado | Qué se hizo / qué queda |
|---|---|---|
| **1** | ✅ **hecha** (2026-11-09) | C1 (perfil sin default + bypass solo con dev), C2 (`GuardiaDeSecretoJwt` + `.env.example` sin secreto), A3 (502 de Maps con mensaje fijo + log), A5 parcial (login rechaza cuentas inactivas; la baja de técnico revoca `tokenVersion`), A10/A12 (`render.yaml` completo + browser key separada en el script de build) |
| **2** | ✅ **hecha** (2026-11-09) | A1 (`@Size(8,72)` en las 5 altas + login con solo máximo + frontend alineado), A2 (3 rutas públicas al cupo + bloqueo por cuenta en el caso de uso de login), M11 (senuelo bcrypt), M10 (409 sin eco del correo), M3 (topes de emisores y tickets + `@PreDestroy`), M16 (`compose` solo en localhost), A5 completada con `isActivo` en el filtro |
| **3a** | ✅ **hecha** (2026-11-09) | `V15__indices_y_unicidad_de_negocio.sql` (A7, A8, A13, A14, barridos, bandejas, FKs sin índice, único de disputa abierta con guarda de duplicados, CHECK de auxiliares) + A15 (`LimpiarOrdenesHuerfanas` ya no carga toda la tabla). **Corregido tras la suite:** el único parcial de `oferta_ot` se retiró — la expiración es perezosa, así que "PENDIENTE con ventana vencida" es un estado legítimo y un predicado de índice no puede excluirlo (`now()` no es inmutable). `OfertaApiIT` lo detectó y la migración quedó documentada en el propio SQL |
| **3b** | ✅ **hecha** (2026-11-09) | A6 (proyección `OtMetrica`); A15 en 3a; **M1 completo**: comprobantes, disputas, liquidaciones del técnico, radar y `NombresOtResolver` resuelven en lote (`buscarPorIds` de OT, clientes, técnicos y usuarios) en vez de una query por fila. Queda solo la paginación (cambia el contrato con el front) |
| **4** | ✅ **hecha** (2026-11-09) | **A16** — `Tecnico.validarPuedeAceptarOrden()` (valida sin mutar) + `TecnicoRepository.ocuparSiDisponible()` (UPDATE condicional). **A9** — el agregado `Ot` lleva la versión de persistencia (`conVersion`), `OtJpaEntity.toDomain` la propaga, `OtRepositoryAdapter.save` la compara y lanza `OptimisticLockingFailureException` (409) en vez de sobrescribir, y `asignarSiDisponible` incrementa `version` en el bulk. Los dos barridos (escalamiento y limpieza) capturan el conflicto por ítem y siguen. **B2** — `V16`: contador `ot_secuencia_anio` con `INSERT ... ON CONFLICT ... RETURNING`; el código de OT ya no escanea la tabla ni puede repetirse entre creaciones concurrentes |
| **5** | 🟡 **parcial** (2026-11-09) | Hecho: A4 (coordenadas del radar redondeadas a ~1 km), A11 (4 cabeceras + CSP en `Report-Only`), M5 (rutas de Sonar corregidas), M9 (`API_ORIGIN` obligatoria en Vercel), M12 (fuera el botón "Foto Demo" y el PDF de ejemplo precargado), M4 parcial (fuera `switchDemoRole`: era el "login como admin" invocable desde consola; sus dos tests eliminados), M6 (`dependency-review` en PRs), M7 (aviso + instrucción del checksum), B8 (`local.properties` fuera de git), B11 (proxy catch-all). Queda: M4 residual (`MockDbService` y `createMockJwt` en el bundle, alcanzables solo con `useMocks`), M8/B16 (Android no versionado), pinning por SHA, CSP a enforcing |

**Verificación final (2026-11-09):**
- Suite de integración completa (`./gradlew test --tests "*IT"`, Testcontainers + PostGIS): **252 pruebas, 0 fallos**, 9m04s. Incluye `AceptacionConcurrenteIT` y `PagarVisitaConcurrenteIT` con A9/A16 aplicados.
- Tests unitarios por clase, todos en verde: `GuardiaDeSecretoJwtTest`, `AutenticarUsuarioUseCaseTest`, `TecnicosUseCaseTest`, `UsuarioApiRequestTest`, `RateLimitFilterTest`, `SseEmitterRegistryTest`, `SseTicketServiceTest`, `MapsRutaApiTest`, `JwtTokenIssuerTest`, `AceptarOfertaUseCaseTest`, `AdministracionUseCaseTest`, `ListarOtUseCaseTest`, `BuscarTecnicosCercanosUseCaseTest`.
- Build de Angular (`npm run build`): OK; los tres JSON de configuración validados.

**Defectos que la propia verificación encontró y se corrigieron en el camino:** el índice único parcial de `oferta_ot` (V15) chocaba con la expiración perezosa — lo detectó `OfertaApiIT`; y el cambio de política de contraseña dejó una fixture de `UsuariosApiIT` con la clave vieja — lo detectó la suite completa. Ambos corregidos.

**Lo que queda abierto y por qué:**
- **Ola 5 residual**: `MockDbService` y `createMockJwt` siguen en el bundle (alcanzables solo con `useMocks`, que es `false`); `frontend/android/` no está versionado, así que endurecer el manifiesto no persiste; las acciones de CI siguen por tag (el pinning por SHA necesita los SHA reales); la CSP está en `Report-Only` hasta ver tráfico limpio.
- **Decisión de producto, no técnica**: respuesta 202 uniforme en el registro (elimina la enumeración pero cambia la UX), paginación de los listados admin (cambia el contrato con el front), y si el radar debe seguir mostrando teléfono del técnico.
- **`.orElse(true)` en el filtro JWT**: se cerró la parte de cuentas inactivas; el sujeto inexistente exige reescribir ~150 fixtures que firman tokens con ids sintéticos.
- **M2 (validar las FKs `NOT VALID`)**: requiere conexión a la base real para pre-chequear huérfanos antes de `VALIDATE CONSTRAINT`.
- **M7**: ✅ resuelto — `distributionSha256Sum` puesto en el wrapper del backend (9.7.1-bin) y en el de Android (8.14.3-all), con los valores de `gradle.org/release-checksums`. La validación efectiva ocurre en la primera descarga con caché limpia (CI); con la distribución ya extraída, Gradle solo lo acepta.

---

## 13. App móvil (Android / Ionic)

Verificación del 2026-11-09 sobre `frontend/projects/mobile` + `frontend/android`.

**Estado verificado:** `ng build mobile --configuration production` OK y **256 specs en verde** (22 archivos), incluidos los nuevos. Matiz importante medido: `ng test` sin `--project` **sí ejecuta los dos proyectos** (890 del web + 256 del móvil), así que los tests del móvil ya estaban cubiertos por CI; lo que **no** estaba cubierto era su **build** (`ng build` sin `--project` compila solo `app`, y un error de template en el móvil dejaba el PR en verde).

**Implementado en esta pasada:**
- **Liquidaciones del técnico** (`pages/liquidaciones-tecnico`): lee `GET /api/tecnicos/me/liquidaciones` (el backend resuelve el técnico del JWT), muestra comisión por consignar, conteos por estado, cada liquidación con código de OT, monto, comisión, estado y motivo de rechazo; con estados de carga, vacío, error con reintentar y pull-to-refresh. De solo lectura: el comprobante de consignación sigue registrándose desde la web.
- **Origen del backend separado por proyecto**: `scripts/generate-mobile-origin.mjs` genera `projects/mobile/src/app/core/environment/mobile-origin.ts` a partir de `MOBILE_API_ORIGIN`. Antes ambos proyectos compartían `api-origin.ts`, así que compilar el móvil con origen absoluto dejaba los specs del web esperando rutas absolutas (fallan). Ahora la web sigue relativa y el móvil absoluta.
- **Guard de arranque**: si el build móvil sale sin `MOBILE_API_ORIGIN`, la app muestra una pantalla de configuración incompleta en vez de fallar en silencio en cada request.
- **Deep links listos, desactivados**: `core/deep-links.ts` trae el mapeo puro (web `/ot/<uuid>`, `coldday://tecnico/ejecucion/<uuid>`, liquidaciones, panel, insumos), valida host/esquema y exige que el id tenga forma de UUID; el listener ni se registra con `habilitado: false`. El intent-filter de Android y el `assetlinks.json` quedan documentados en el propio archivo para cuando exista la publicación.
- **CI**: job `mobile-build` (build de producción con `MOBILE_API_ORIGIN`); los specs ya corrían en el job existente. El job del web no define orígenes para no alterar sus specs.

**Cadena hasta el APK (verificada, 2026-11-09):**
`ng build mobile` NO produce un APK: deja el bundle web en `dist/mobile/browser`. El APK lo arma Gradle:
1. `npm run mobile:build` → bundle web.
2. `npm run mobile:sync` → `cap sync android` copia el bundle a `android/app/src/main/assets/public` y actualiza los plugins.
3. `npm run mobile:apk` → `assembleDebug` → **`android/app/build/outputs/apk/debug/app-debug.apk`** (7.85 MB, firmado con la clave de depuración, instalable con `adb install`).
4. `npm run mobile:aab` → `bundleRelease` para Play (ver requisitos abajo).

**Bug encontrado en esa cadena:** `android/local.properties` tenía **BOM UTF-8** y Gradle lo lee como ISO-8859-1, así que la clave quedaba como `\uFEFFsdk.dir` y el build abortaba con "SDK location not found" aunque el SDK estaba instalado. Se quitó el BOM y `scripts/build-apk.mjs` ahora lo detecta y corrige con un aviso. Requisitos del entorno: Android SDK (`sdk.dir`) y JDK compatible con el wrapper de Gradle 8.14 del proyecto Android.

**Para publicar en Play (pendiente, no bloqueante hoy):** `versionCode 1` / `versionName "1.0"` en `android/app/build.gradle` hay que incrementarlos por release; `bundleRelease` necesita `signingConfig` + keystore (no configurado); y conviene versionar `frontend/android/` para que estos ajustes no se pierdan al regenerar la plataforma.
- **Accesibilidad**: se quitó `user-scalable=no`/`maximum-scale=1` del viewport (bloqueaba el pinch-zoom, WCAG 1.4.4).

**Fricción pendiente (verificada, no corregida):**
- **Botón atrás de Android**: no hay listener `backButton`; en el root de un tab el gesto cierra la app sin confirmación (`App.addListener('backButton')` en `app.config.ts`).
- **`equipos` (cliente) sigue siendo placeholder**: el tab existe y muestra "Próximamente".
- **`frontend/android/` no está versionado**: `allowBackup="true"` y `usesCleartextTraffic="true"` en el manifiesto, pero cualquier endurecimiento se pierde al regenerar la plataforma.
- **`@capacitor/preferences`** está instalado y registrado en `capacitor.plugins.json` sin uso.
- **Spec intermitente**: `seguimiento-ot.page.spec.ts › carga la OT y pinta badge, timeline y técnico` falló una vez y pasó en las dos corridas siguientes; es sensible a tiempos (40 s de archivo). Es el primer sospechoso si el job móvil parpadea en CI.
