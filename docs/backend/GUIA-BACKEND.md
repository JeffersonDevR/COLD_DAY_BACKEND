# GUIA-BACKEND — reglas y convenciones del backend

Complementa `ARQUITECTURA.md` (el porqué) con lo que **hay que cumplir** (el cómo). Las reglas `BE-xx` marcadas *(automática)* las verifica `backend/scripts/check-backend-rules.mjs` con techos que **solo bajan**; el resto se verifica con tests (`./gradlew test`) y la Definición de hecho (§7).

> **Si eres un modelo/agente:** esto es ley. No marques una tarea como hecha sin §7. No desactives tests, no uses `-x test`, no subas techos, no edites `backend-rules.baseline.json` a mano, no añadas `@SuppressWarnings`/`@Disabled` para esconder un fallo. Si algo parece incorrecto, detente y pregunta.

Estado de la revisión (2026-11-12): casi todos los hallazgos críticos/altos de `odd/audits/2026-11-09-auditoria-fallas-fugas-arquitectura.md` ya están corregidos (JWT sin secreto de dev fuera de dev, `@Size` de contraseña, rate limit en altas, UPDATE condicional al aceptar oferta, índices V15/V16, límite de emisores SSE, hash señuelo). Lo abierto está en `TAREAS-BACKEND.md`.

---

## 1. Estructura (respétala; no inventes capas)

```
com.sena.cold_day.core
├─ modules/<modulo>/
│  ├─ application/{usecases,dto}
│  ├─ domain/{aggregates,valueobjects,repository,exception}
│  └─ infrastructure/{api/{controllers,requests,responses},persistence,repository,scheduling,listeners,mail,google}
└─ shared/{errors,infrastructure/{security,sse,seed,config}}
```
Módulos: `ot`, `proveedores`, `usuarios`, `tecnicos`, `administracion`, `maps`, `clientes`, `geolocalizacion`.

- **BE-A1** El dominio no importa nada de `infrastructure` ni de Spring web/JPA. Casos de uso dependen de **puertos** (`XxxRepository`, `XxxPort`), no de adaptadores.
- Nombres: `XxxUseCase` (español), entidades `XxxJpaEntity`, DTOs `XxxApiRequest` / `XxxApiResponse` (`fromDomain`/`from`), excepciones de dominio en `domain/exception`.
- Comentarios y mensajes: español (muchos sin tildes; sé consistente con el archivo).

## 2. Seguridad

- **BE-S1** *(automática)* Sin secretos literales en código. Secretos por variable de entorno; `app.jwt.secret` y `CORS_ALLOWED_ORIGINS` son obligatorios en prod (la app **falla al arrancar** si faltan: fail-closed; no lo cambies).
- **BE-S2** *(automática, heurística)* Todo endpoint lleva `@PreAuthorize("hasRole(...)")` (o `@PermitAll` justificado). La **propiedad del recurso** se valida con `AutorizacionPropietario`; el **rol nunca viene del body**.
- **BE-C1** *(automática)* CORS sin `*`. Dev permite `http://localhost:4200`, `capacitor://localhost`, `https://localhost`, `ionic://localhost`. Si necesitas otro origen en dev: `CORS_ALLOWED_ORIGINS`, no cambies el código.
- Contraseñas: `@Size(min=8,max=72)` en altas/reset; login solo `max=72`. Hash con el `PasswordEncoderPort`; hay hash señuelo para igualar tiempos: no lo quites.
- Rate limit de auth: 10 intentos/60 s por IP+ruta (`RateLimitFilter`, `getRemoteAddr()`; en prod depende del proxy). Bloqueo por cuenta tras 10 fallos/15 min.
- SSE: ticket de un solo uso; límite de emisores por clave; `@PreDestroy` cierra emisores. No crees otro registro de emisores.
- No loguear tokens, contraseñas ni correos completos a INFO. `logToken` debe estar en `false` en prod.
- El seeder `DevDataSeeder` es **solo dev** (`app.seed.enabled`). Contraseña demo en `app.seed.demo-password`; en prod debe estar apagado.

## 3. Errores y contrato de API

- **BE-E1** *(automática)* Prohibido devolver `getMessage()` de excepciones de infraestructura al cliente. Solo excepciones de dominio con mensaje pensado para el usuario. El detalle técnico se loguea.
- Formato de error: `ApiError(status, mensaje, List<String> errores)`. **Hoy hay dos formas** (`List<ApiError>` en `SecurityConfig`/`MapsControllerAdvice` y `ApiError` suelto en `GlobalControllerAdvice`): unificarla es la tarea TB-02. Hasta entonces, **no introduzcas una tercera**.
- Códigos: 400 validación, 401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto de concurrencia/unicidad, 429 rate limit (con `Retry-After`), 502 proveedor externo.
- Un `ControllerAdvice` por módulo para sus excepciones de dominio + `GlobalControllerAdvice` para lo transversal.

## 4. Datos, transacciones y concurrencia

- **BE-P1** *(automática)* Prohibido listar tablas completas desde un caso de uso (`findAll()`, `listarTodas()`, `findByActivoTrue()` sin límite). Toda lista de admin/métricas pagina o limita. Hoy hay 13 usos: es la deuda de mayor impacto (TB-01).
- `@Transactional` en el caso de uso; `readOnly = true` en consultas.
- Escrituras concurrentes (p. ej. "el primer técnico que acepta toma la OT"): **UPDATE condicional que devuelve filas afectadas**; 0 filas ⇒ excepción de dominio. No uses leer-modificar-guardar sin bloqueo.
- **Flyway:** `V{n}__descripcion.sql`, **append-only** (el CI lo comprueba), `IF NOT EXISTS`/`DO $$` para idempotencia. Última: V16; la siguiente V17. `ddl-auto=validate` siempre. **BE-D1** *(automática)*.
- Índices para toda consulta nueva por columna no PK (GiST para geografía). Sin N+1: usa carga en lote (`NombresOtResolver`).
- **BE-J1** *(automática)* Cada `@Scheduled` debe ser seguro con 2 instancias (`@SchedulerLock` con ShedLock) o estar documentado "1 instancia" en `render.yaml`. Hoy hay 7 sin bloqueo (TB-03).

## 5. Pruebas

- JUnit 5 + Testcontainers/PostGIS (`PostgisContainerInitializer`, `LimpiezaBaseDatosListener`, `FkFixtures` en `src/test/.../support`). **Docker es obligatorio** para correrlas. Seed y bypass de auth apagados en tests.
- Toda corrección de bug añade el test que lo habría atrapado. Todo endpoint nuevo: test de 401, 403 (rol equivocado) y camino feliz.
- Los barridos programados se invocan directamente en el test (no con reloj).
- Cobertura desigual (archivos test/main): `ot` 45/127 · `proveedores` 17/65 · `usuarios` 14/54 · **`tecnicos` 11/61** · **`administracion` 7/49** · `maps` 6/17 · `clientes` 5/22 · `geolocalizacion` 5/11. Prioriza `tecnicos` y `administracion`.

## 6. Comandos (desde `backend/`)

| Qué | Comando |
|---|---|
| Reglas del backend | `node scripts/check-backend-rules.mjs` |
| Build + todos los tests (lo que corre el CI) | `./gradlew build --console=plain` (Windows: `.\gradlew.bat build`) |
| Un test | `./gradlew test --tests "*AceptarOferta*"` |
| Arrancar en dev | `./gradlew bootRun` (inyecta perfil `dev`; Postgres en `127.0.0.1:5433` con `docker-compose.yml`) |
| Sin perfil activo | la app **no arranca** a propósito |

Wiring que no se puede saltar: CI (`backend-ci.yml`: `build-and-test`, `migration-dry-run`, `migrations-append-only`, `backend-rules`) · hook `.githooks/pre-commit` (corre `check-backend-rules` si tocaste `backend/`).

## 7. Definición de hecho (con evidencia)

- [ ] `node scripts/check-backend-rules.mjs` OK y ninguna regla sube (pega la salida).
- [ ] `./gradlew build` en verde (con Docker) — pega el resumen de tests.
- [ ] Test nuevo que cubre el cambio (y el 401/403 si es un endpoint).
- [ ] Migración nueva solo si hace falta, `V17+`, append-only, probada contra PostGIS.
- [ ] Sin secretos, sin `getMessage()` de infraestructura hacia el cliente, sin lectura sin paginar.
- [ ] Formato de error consistente con §3.
- [ ] Nada fuera del alcance de la tarea (no tocar `frontend/`).
- [ ] Si cambió un contrato de API: actualizado `frontend/src/app/core` / `@core` y sus specs, y `docs/mobile-paridad.md` si aplica.
