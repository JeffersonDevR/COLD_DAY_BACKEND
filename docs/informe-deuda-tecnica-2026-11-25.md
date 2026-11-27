# Informe de deuda técnica y diseño del sistema

Fecha: 2026-11-25 · Rama: `feat/mobile-navegacion-push` · Alcance: backend, frontend web, app móvil, CI/despliegue, documentación.

**Método.** Lectura de `ARQUITECTURA.md`, `GUIA-BACKEND.md`, `TAREAS-BACKEND.md`, `pendientes.md`; ejecución de `check-backend-rules.mjs` y `npm run ui:check` (ambos **OK**, ninguna regla sube); conteos y `grep` sobre el código. **No** corrí `./gradlew build` ni las suites de test (requieren Docker), así que no hay medición de cobertura ni de tests en verde. Lo marcado *(sin verificar)* sale de los documentos del repo, no de mi lectura del código.

Prioridad = (Impacto + Riesgo) × (6 − Esfuerzo), cada eje de 1 a 5.

---

## 1. Resumen

El diseño base es sano: módulos verticales con dominio sin JPA, FKs escalares entre módulos, aceptación de ofertas con UPDATE condicional, Flyway append-only, verificadores con techos que solo bajan y CI con cuatro checks. La deuda no está en la forma del sistema sino en **lo que rodea al código**:

1. **El despliegue puede saltarse los tests** (Dockerfile con `-x test` + `autoDeploy: true`).
2. **Las lecturas de admin/métricas son O(tabla)**, y el sistema está pensado para 1 instancia (jobs sin lock, SSE en memoria).
3. **Los documentos que gobiernan a los agentes están desactualizados**; uno de ellos puede provocar una colisión de migración.
4. **Dos capas de frontend con un núcleo de mocks grande** y techos de UI web altos.

---

## 2. Backlog priorizado

| # | Deuda | Tipo | Imp | Ries | Esf | Prio |
|---|---|---|---|---|---|---|
| 1 | Deploy automático sin gate de tests | Infra | 3 | 5 | 1 | **40** |
| 2 | 27 endpoints sin `@PreAuthorize` cercano (BE-S2) | Código/seguridad | 3 | 4 | 2 | **28** |
| 3 | `GUIA-BACKEND` dice «última V16, siguiente V17»; ya existe V20 | Docs | 2 | 3 | 1 | **25** |
| 4 | Sin Dependabot/Renovate; Actions por tag; springdoc 2.8.5 sobre Boot 4.1.1 | Dependencias | 2 | 3 | 1 | **25** |
| 5 | Lecturas sin paginar (BE-P1: 13) y métricas cargando entidades | Código | 4 | 4 | 3 | **24** |
| 6 | Rate limit solo en 7 rutas POST; sin cubrir `/api/maps/*`, `/cercanos`, `POST /api/ot` | Seguridad | 2 | 4 | 2 | **24** |
| 7 | Dos formas de error + 19 `getMessage()` en la capa API (BE-E1: 18) | Código | 3 | 2 | 2 | **20** |
| 8 | `versionVigente` con `orElse(true)` | Seguridad | 1 | 3 | 1 | **20** |
| 9 | Sin correlation id / MDC; solo `health,info` | Infra | 2 | 3 | 2 | **20** |
| 10 | Cobertura desigual: `tecnicos` 11/61, `administracion` 7/49; móvil 26 specs / 50 `.ts` | Tests | 3 | 3 | 3 | **18** |
| 11 | 7 `@Scheduled` sin ShedLock (BE-J1) + registro SSE en memoria | Arquitectura | 2 | 4 | 3 | **18** |
| 12 | Sin idempotencia en altas críticas (`POST /api/ot/{id}/insumos`) | Código | 2 | 3 | 3 | **15** |
| 13 | Capa de mocks (`mock-db.service.ts` 1.596 líneas; `useMocks()` en cada API) y pantallas con datos falsos (B12–B14) | Código | 3 | 3 | 4 | **12** |
| 14 | Techos de UI web altos: UI-D4 660, UI-C1 244, UI-T1 122, UI-T2 74, UI-A2 28 | Código/a11y | 3 | 2 | 4 | **10** |
| 15 | Higiene del repo: 78 ramas locales (71 ya en `main`), 4 stashes, 28 sin trackear, `.bak`, `probe-dump.html`, `tmp-capturar.mjs` | Repo | 1 | 1 | 1 | **10** |
| 16 | `Ot` de 942 líneas / 72 métodos públicos; acoplamiento entre casos de uso (`ot→tecnicos` 42 imports, `administracion→ot` 36) | Arquitectura | 3 | 2 | 5 | **5** |

### Detalle de lo más relevante

**1. Deploy sin gate (40).** *(Corregido: el despliegue es en **Railway**; `render.yaml` es un resto sin uso y puede borrarse.)* `backend/Dockerfile` compila con `bootJar -x test`, así que la imagen nunca ejecuta tests; el único gate es el CI de GitHub. Si Railway despliega al hacer push a `main` sin esperar al CI, un commit con tests rojos llega a producción. Railway tiene la opción «Wait for CI» en el servicio. *(Sin verificar)*: esa opción y que "Backend CI / build-and-test" sea check requerido en `main`; ninguno de los dos se ve desde el repo. Es configuración, no código.

**2. BE-S2 (28).** El verificador es una heurística (busca `@PreAuthorize` cercano); 27 puede incluir falsos positivos. `ARQUITECTURA.md` ya señalaba que `TecnicoController` solo tiene dos endpoints anotados. Hay que revisarlos uno por uno contra `SecurityConfig`: cada uno o lleva anotación o queda documentado en un `@PermitAll` justificado. Añadir test 401/403 por endpoint (esto se solapa con el ítem 10).

**3. Deriva documental (25).** Un agente que siga `GUIA-BACKEND.md` §4/§7 creará `V17__…`, que ya existe (`V17__ot_prioridad.sql`); Flyway fallará por versión duplicada. Otros desfases: `ARQUITECTURA.md` (2026-09-29) dice que push es solo logging y que falta CORS, cuando existen `FcmNotificacionPushAdapter`/`FirebaseFcmSender` (apagado por defecto: `FCM_ENABLED=false`) y la config CORS; `ARQUITECTURA.md` §16 describe el despliegue en Render (`render.yaml`), pero producción está en Railway; `pendientes.md` es del 2026-10-19; `ARQUITECTURA.md` no cubre `frontend/` ni `V7–V20`. Esfuerzo mínimo, arregla una trampa real.

**5. Paginación (24).** Los 13 usos están en `ListarOtUseCase`, `GestionarDisputaUseCase`, `VerificarComprobanteUseCase`, `ListarProveedoresUseCase`, `BuscarTecnicoUseCase` y `ConsultarMetricasAdminUseCase` (que carga técnicos y liquidaciones completos para agregar en memoria). Tres de ellos son barridos de jobs (`ReconciliarTecnicosOcupados`, `VerificarVigenciaDocumental`, `SolicitarInsumo`) que pueden quedar como están por ser acotados al dominio activo, pero las rutas de admin crecen con el negocio. Es la deuda de mayor impacto real (TB-01).

**6. Rate limit (24).** `RUTAS_LIMITADAS` tiene 7 rutas exactas. `/api/maps/*` consume la server key de Google (coste directo). La existencia de `LIMIT` en la búsqueda de técnicos cercanos *(sin verificar: el adaptador está en otro paquete y no lo localicé)*.

**8. `versionVigente` (20).** El propio comentario del filtro declara la deuda: un token de usuario borrado sigue válido hasta expirar. Hoy ningún flujo borra filas de `usuario`, por eso el riesgo es bajo, pero el cambio es de una línea con su test.

**11. Una sola instancia (18).** Es una decisión no tomada (TB-03): ¿se escalará a más de una instancia? Mientras la respuesta sea no, los 7 `@Scheduled` y el `SseEmitterRegistry` en memoria son correctos. Lo que falta es **escribir la decisión** en `GUIA-BACKEND.md` para que nadie suba las réplicas en Railway sin saberlo. Ojo: un *deploy* de Railway con solapamiento (la instancia nueva arranca antes de apagar la vieja) también ejecuta los jobs dos veces durante unos segundos; los UPDATE condicionales lo toleran, pero conviene saberlo.

**13. Mocks (12).** El modo mock está cableado en cada servicio de API del frontend (`apiConfig.useMocks()`), con una base en memoria de 1.596 líneas que hay que mantener en paralelo al contrato real. `pendientes.md` ya lista pantallas con datos imaginarios (B12 «Mis equipos», B13 chat de diagnóstico falso, B14 valores por defecto falsos); `AGENTS.md` regla 6 prohíbe inventar datos. Verificar cuáles siguen vivas en móvil.

---

## 3. Revisión del diseño del sistema

**Qué funciona y conviene proteger**

- Dominio sin dependencias de framework y persistencia paralela (`fromDomain/toDomain`); FKs escalares. El acoplamiento entre módulos está en la capa de aplicación, de forma consciente y documentada.
- Concurrencia resuelta en SQL (UPDATE condicional) en vez de locks: simple y correcta para la carrera «varios técnicos aceptan».
- Notificación como *best-effort*: el estado en BD es la fuente de verdad; un fallo de push o Maps nunca bloquea la OT.
- Gobierno del repositorio: baselines que solo bajan, hooks, CI con dry-run de migraciones y comprobación append-only. Es poco común y vale mucho.

**Tensiones de diseño**

| Tensión | Evidencia | Recomendación |
|---|---|---|
| **Aplicación acoplada entre módulos** | `ot→tecnicos` 42 imports, `administracion→ot` 36, `ot→clientes` 28 | No refactorizar ahora. Regla nueva: ningún caso de uso importa `infrastructure` de otro módulo, y solo puertos de dominio. Verificable con un `grep` más en `check-backend-rules.mjs` (solo con aprobación: es subir el listón, no el techo). |
| **`Ot` como agregado grande** | 942 líneas, 72 métodos públicos (ciclo, disputa, tarifa, insumos, llegada, calificación) | Extraer solo cuando una próxima feature lo obligue; la máquina de estados ya está aislada en `TransicionesOt`. |
| **Estado en proceso** | SSE, rate limit (Caffeine), tickets SSE: todo en memoria | Aceptable en 1 instancia. Documentar el límite; si se escala, necesita broker para SSE y ShedLock a la vez, no uno sin el otro. |
| **Errores con dos contratos y 17 `ControllerAdvice`** | `List<ApiError>` vs `ApiError` | Unificar (TB-02) antes de que el móvil dependa de cualquiera de las dos. |
| **Web y móvil comparten `@core` pero duplican pantallas** | web 25 páginas, móvil 20; 58 archivos móviles importan `@core` | El núcleo compartido es buena decisión. Lo que duplica es la capa de pantalla; mantener `docs/mobile-paridad.md` y no aumentar el web admin sin necesidad. |
| **CSS móvil monolítico** | `pantallas.css` 3.531 líneas | Dividir por pantalla cuando se toque cada una (no como tarea aparte). |

---

## 4. Plan por fases (junto al trabajo de features)

**Fase 0 — esta semana, ~1 día, sin tocar lógica**
- #1 Hacer obligatorios los checks en `main` y activar «Wait for CI» en Railway. Borrar `render.yaml` (huérfano) y corregir las menciones a Render en docs.
- #3 Corregir `GUIA-BACKEND.md` (última migración V20 → siguiente V21) y refrescar `ARQUITECTURA.md` (push FCM, CORS, frontend).
- #4 Añadir `.github/dependabot.yml` (Gradle, npm, GitHub Actions).
- #15 Que el humano pode ramas ya mergeadas y revise `.bak`/probes (la regla 7 impide que lo haga yo).

**Fase 1 — 1–2 semanas, junto a features**
- #8 `orElse(false)` en `versionVigente`, con test.
- #6 Ampliar el rate limit a `/api/maps/*`, `/api/tecnicos/cercanos`, `POST /api/ot`; confirmar `LIMIT`.
- #2 Revisar uno por uno los 27 endpoints de BE-S2 y cubrirlos con tests 401/403.
- #7 Unificar `ApiError` y quitar los `getMessage()` expuestos (BE-E1 18 → 0 por lotes).

**Fase 2 — 2–4 semanas**
- #5 Paginación de admin y métricas con agregación en SQL (TB-01). Primero `ConsultarMetricasAdminUseCase`.
- #10 Tests de `tecnicos` y `administracion` (trío 401/403/feliz por controlador); primeras specs de las páginas móviles sin cobertura.
- #9 `correlationId` en MDC y probes `readiness`/`liveness`.
- #11 Decidir y documentar «1 instancia».

**Fase 3 — cuando haya capacidad**
- #12 Idempotencia por `Idempotency-Key` en `insumos` y altas de OT.
- #13 Retirar el modo mock en las páginas que ya tienen backend real; eliminar las pantallas con datos falsos.
- #14 Bajar los techos web de UI de forma oportunista (cada pantalla que se toque baja su conteo y se regenera con `--update`).
- #16 Solo reabrir si un cambio de negocio exige partir `Ot`.

---

## 5. Lo que no pude verificar

- Suites de test y cobertura (no ejecuté `./gradlew build`; requiere Docker).
- Protección de rama en GitHub y la configuración de Railway (Wait for CI, réplicas, límite de conexiones de su Postgres).
- Todo lo de rendimiento de la sección 7 es **análisis estático**: no medí tiempos ni ejecuté `EXPLAIN` (no hay acceso a datos reales).
- Si los 27 hallazgos de BE-S2 son endpoints realmente desprotegidos o falsos positivos de la heurística.
- Presencia de `LIMIT` en la consulta de técnicos cercanos.
- `npm audit` / CVEs de dependencias (no se ejecutó; sin red de auditoría en este análisis).

## 7. Rendimiento de consultas (añadido a petición)

**Alcance y límite.** Análisis estático de índices (`V1`–`V20`), 18 `@Query`, SQL nativo, finders y casos de uso. **No hay mediciones**: el sistema no puede decir hoy cuánto tarda una consulta (ver 7.4). Las cifras de abajo son por lo tanto *riesgo por forma de la consulta*, no tiempos.

### 7.1 Lo que está bien

- **Búsqueda espacial** (`PostgisTecnicoDisponibilidadAdapter`): la expresión `ST_MakePoint(longitud, latitud)::geography` y los predicados `activo / APROBADO / DISPONIBLE` coinciden con el índice GiST parcial `idx_tecnico_disponible_ubicacion_geo`, así que el planificador puede usarlo. Es la consulta más caliente del dominio y está bien diseñada.
- **Escritura concurrente** con UPDATE condicional: una sola sentencia, sin lectura previa ni locks largos.
- **`open-in-view=false`**: ninguna conexión queda retenida durante el render de la respuesta ni por los streams SSE.
- **Índices compuestos pensados para las listas del usuario**: `ot(cliente_id, creada_en DESC)`, `ot(tecnico_id, creada_en DESC)`, `oferta_ot(tecnico_id, estado)`, `idx_ot_buscando_ventana` (job de 5 s), índices parciales de insumos.
- Pool configurable (`DB_POOL_MAX`, 10 por defecto) con `connection-timeout` de 10 s en prod.

### 7.2 Hallazgos, por impacto esperado

| # | Hallazgo | Dónde | Por qué es lento | Arreglo |
|---|---|---|---|---|
| P1 | **El dashboard de admin recorre toda la tabla `ot`** en cada carga | `RESUMEN_METRICAS = SELECT estado, categoria_servicio, creada_en, asignada_en, finalizada_en FROM ot` en `OtRepositoryAdapter:51`; luego `ConsultarMetricasAdminUseCase` cuenta y agrupa en Java | Crece lineal con el histórico; transfiere todas las filas por la red a cada refresco. Con el canal SSE `admin` y recargas por evento, se dispara a menudo | `GROUP BY estado`, `GROUP BY categoria_servicio` y `date_trunc('day', …)` con `WHERE finalizada_en >= now() - interval '7 days'`. El «promedio de asignación» es un `AVG(asignada_en - creada_en)` |
| P2 | El mismo caso de uso carga **todas las liquidaciones** (`listarTodas()`) solo para sumar las del mes, y **todos los técnicos activos** como agregados completos (con conversión de `jsonb`) solo para contar tres estados | `ConsultarMetricasAdminUseCase:76,144` | Hidrata entidades y convierte `jsonb` de certificaciones por técnico sin usarlas | `SUM … WHERE creada_en >= inicio_de_mes` y `COUNT(*) FILTER (WHERE …)` |
| P3 | **Listado de OT de admin: `findAll()` de entidades completas** | `OtRepositoryAdapter:151` → `ListarOtUseCase.listarTodas` | Cada fila trae `diagnostico`, `presupuesto` y `evidencia_urls` (`jsonb`) que una lista no muestra, y se deserializan | Paginar (TB-01) y usar una proyección de resumen en lista |
| P4 | `@OneToMany(fetch = EAGER)` en `RequerimientoInsumoJpaEntity` | `RequerimientoInsumoJpaEntity:101` | Cada lectura de requerimientos arrastra sus líneas; en listas es N+1 o join multiplicado | `LAZY` + `@EntityGraph` / carga en lote solo donde se muestran las líneas |
| P5 | **N+1 en el barrido diario de vigencia** | `VerificarVigenciaDocumentalUseCase:44-49`: por cada técnico activo, `documentoRepository.buscarPorTecnico(id)` | 1 + N consultas; corre una vez al día pero con N técnicos | Una consulta `WHERE tecnico_id IN (…)` o `WHERE vence_en < :limite` directamente sobre `documento_tecnico` |
| P6 | **Barridos periódicos que cargan agregados completos** | `ReconciliarTecnicosOcupados` (cada 60 s, todos los técnicos activos); `LimpiarOrdenesHuerfanas` (cada 5 min, todas las OT en ciertos estados) | Trabajo constante de fondo proporcional al total, aunque no haya nada que corregir | Consulta de candidatos en SQL (técnicos `OCUPADO` sin OT activa con `NOT EXISTS`; OT por estado **y** antigüedad, con índice) |
| P7 | Búsqueda de técnicos cercanos sin `LIMIT` y con `ORDER BY` global | `PostgisTecnicoDisponibilidadAdapter:60` | Con muchos técnicos disponibles en el radio ordena todos; la capa de arriba solo necesita unos cuantos | `LIMIT` (p. ej. 50). El índice acelera el filtro, no el orden |
| P8 | Resolución de nombres/códigos con una consulta por fila | `CargarComprobanteUseCase:65`, `VerificarComprobanteUseCase:124`, `ListarLiquidacionesTecnicoUseCase:46` (`buscarPorId` dentro de `enriquecer`) | N+1 en listas de liquidaciones | Reusar el patrón de carga en lote que ya existe (`NombresOtResolver`) |
| P9 | Índices redundantes en `ot`, `oferta_ot` | `idx_ot_cliente_id` ⊂ `idx_ot_cliente_creada`; `idx_ot_tecnico_id` ⊂ `idx_ot_tecnico_creada`; `idx_oferta_ot_tecnico_id` ⊂ `idx_oferta_ot_tecnico_estado`; `idx_ot_estado` ⊂ `idx_ot_estado_tecnico` | Cada uno añade coste a todo INSERT/UPDATE de `ot` (la tabla más escrita: cada transición) | Eliminarlos con una migración `V21` **tras** comprobar con `pg_stat_user_indexes` que `idx_scan = 0`. No tocar migraciones previas |
| P10 | Sin paginación en ninguna lista (BE-P1 = 13) | ver ítem 5 | Es el multiplicador de P1–P3 | TB-01 |

Orden recomendado: **P1+P2** (un dashboard que se recarga por eventos es la ruta más fácil de saturar), **P3+P10**, **P6**, **P4/P5/P8**, **P7**, y P9 al final con datos.

### 7.3 Pool y conexiones (Railway)

- El pool por defecto es 10. Con un solo servicio no es un problema; sí lo sería si se añaden réplicas, porque `réplicas × 10` debe quedar por debajo del `max_connections` del Postgres de Railway *(sin verificar el límite de tu plan)*.
- Los jobs de 5 s y 60 s usan conexiones del mismo pool que las peticiones. Una consulta lenta de P1 puede, bajo carga, dejar sin conexión al escalamiento de OT. Es una razón más para sacar P1/P6 del camino.
- Latencia de red entre el servicio y el Postgres: si no están en la misma región de Railway, cada N+1 se paga por viaje. Conviene confirmar la región de ambos.

### 7.4 No hay forma de medir (deuda en sí misma)

- Solo `health,info` expuestos; sin Micrometer ni métricas HTTP/JDBC.
- No hay log de consultas lentas (`show-sql=false`, sin `generate_statistics`, sin `log_min_duration_statement` documentado).
- No hay `pg_stat_statements` mencionado ni `EXPLAIN` guardado para las consultas clave.
- Existe `load-tests/results/`, pero no hay un guion reproducible versionado junto a una línea base *(sin verificar su contenido)*.

**Plan de medición mínimo (medio día):**
1. En Railway Postgres: activar `pg_stat_statements` y `log_min_duration_statement = 200` (ms). Cuando tengas tráfico real, revisar las 10 sentencias con mayor tiempo total.
2. En el backend: `spring.jpa.properties.hibernate.session.events.log.LOG_QUERIES_SLOWER_THAN_MS=200` en prod (o Micrometer + `http.server.requests`), sin SQL con parámetros por la regla de no loguear datos sensibles.
3. Un `EXPLAIN (ANALYZE, BUFFERS)` por cada consulta de P1, P3, P7 y la espacial con ~10k OT y ~1k técnicos sembrados; guardarlo en `docs/backend/`.
4. Un test de integración con volumen para cada arreglo (ya lo pide TB-01) que falle si la cantidad de sentencias por petición supera un tope (detecta N+1 de forma permanente).

### 7.5 Fases añadidas al plan

- **Fase 0:** activar `pg_stat_statements` + log de consultas lentas (configuración, sin código).
- **Fase 1:** P7 (`LIMIT`), P5 y P8 (N+1 de poco riesgo).
- **Fase 2:** P1+P2 como parte de TB-01, P3, P4, P6.
- **Fase 3:** P9 con datos de `pg_stat_user_indexes`.

---

## 6. Salida de los verificadores

```
backend-rules: OK   (BE-P1 13/13 · BE-E1 18/18 · BE-J1 7/7 · BE-S2 27/27 · resto 0/0)
ui-rules: OK        (0 pares de contraste fuera de umbral)
```
