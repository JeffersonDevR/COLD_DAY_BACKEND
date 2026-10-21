# Feature: mapa-ruta-tecnico

## Objective
Que el cliente vea al técnico moverse y dónde va, **sin recargar** y **sin gastar cuota de Google Maps**: mapa de seguimiento en la vista de OT con el técnico en vivo, la "ruta" al destino y una ETA local.

## Problem (mapeo verificado 2026-10-19)
1. **Quota**: `seguimiento-ot-page.ts:221-253` hacía el poll de posición cada 15 s y **en cada tick llamaba `POST /api/maps/distancia`** (Distance Matrix de Google) → 4 llamadas/min por cliente.
2. **No hay mapa en el momento que importa**: el `<app-mapa-radar>` solo se renderiza en `SOLICITADA|BUSCANDO_TECNICO` (`seguimiento-ot-page.html:151-161`). En `EN_CAMINO` **no hay mapa**, y no existía ningún marcador del técnico.
3. **No hay Directions en el proxy**: `/api/maps` expone `estado`, `geocode`, `inversa`, `autocompletar`, `distancia` (upstream `distancematrix/json`). **No hay `directions`/`routes`** y el scope de la key no es verificable → la ruta NO puede depender de Google.
4. **Constantes duplicadas**: `cucuta.constant.ts:11,17-22`, `mapa-radar.ts:63-64`, `seguimiento-ot-page.html:156-157`, `registro-page.ts:163`, `environment.ts:39-42` vs backend `app.tarifa.centro-lat/lng` + `app.maps.*`.
5. **Key de Maps**: el loader caía a `GET /api/config/maps` — **ese endpoint no existía** (404) → en dev no había mapa.
6. **La llegada era invisible**: `Ot.confirmarLlegada` (EN_CAMINO, idempotente) fija `llegadaEn`, pero **no estaba en ninguna respuesta de la API** → el cliente no podía enterarse.

## Decisiones (para que no crezca el alcance)
- **Cero llamadas nuevas a Google.** La "ruta" es una **línea recta** al destino y la ETA es **local** (haversine, `km/25·60`, la misma fórmula que el backend). La librería `geometry` ya se pide en el loader.
- **Sin Directions API** hasta que se verifique el scope de la key y se acepte el costo (feature aparte).
- La **llegada es un hecho, no una transición**: se notifica con el evento y la clave que el front **ya consume**, sin canal ni endpoint nuevos.

## Scope
- **T1 (frontend):** la distancia/ETA deja de llamar a Google por tick → cálculo local.
- **T2 (backend+frontend):** `GET /api/config/maps` + el front consume esa config y se eliminan las duplicaciones y el código muerto.
- **T3 (frontend):** mapa de seguimiento: marcador del técnico moviéndose (poll existente), destino y línea recta, visible también en `EN_CAMINO`.
- **T4 (backend):** `llegadaEn` en la respuesta de la OT + evento SSE.
- **T4-bis (frontend):** la página de seguimiento muestra la llegada.
- **T5 (parent):** verificación final.

## Out of scope (documentado)
- **Directions API / polyline real de Google** (scope de key no verificable + costo por viaje): queda para un feature propio.
- **Geo-arrival automático** (umbral haversine/ST_DWithin que dispare la transición solo): hoy la llegada es manual (`POST /api/ot/{id}/llegada`). Se expone el dato; automatizarlo es otro slice.
- `ejecucion-ot-page.ts:131` reporta ubicación aunque el técnico esté solo `DISPONIBLE` (no ejecutando): afecta **batería**, no cuota de Maps — follow-up aparte.
- El resto del roadmap del usuario (alertas de OT, registro de proveedores en admin, filtro de OTs del cliente, repuestos) vive en `roadmap/implementaciones-2026-10-19` y en `docs/pendientes.md`.

## Follow-ups (pendientes, fuera de alcance de este feature)
- **Locale de fechas**: la app no registra `LOCALE_ID` → las fechas salen en `en-US` dentro de textos en español. Fix de 1 línea (`registerLocaleData` + `LOCALE_ID` es-CO) pero cambia el render de fechas de **toda** la app: decisión del usuario, no se tomó acá.
- **El mapa recentra cada 15 s** (pisa un pan manual del usuario) y `restriction.strictBounds` puede recortar a un técnico fuera del área metropolitana.
- **El render real del mapa no se ejercitó en navegador** (los tests dejan el loader stubbeado, igual que `mapa-radar.spec.ts`): probarlo en la app antes de mergear.

## Constraints
- Frontend: copy y comentarios en **español**; backend: inglés.
- TDD standard. Runners: frontend `npm test -- --watch=false`, `npx tsc -p tsconfig.app.json --noEmit` y `-p tsconfig.spec.json`, `npx eslint <tocados>` (8 errores preexistentes repo-wide); backend `cd backend && gradlew.bat test` (Docker).
- Un writer por tarea, secuencial. Rama `feat/mapa-ruta-tecnico` desde `origin/main`.
- Push / PR / merge: decisión del usuario.

## Authorized scope
Usuario (2026-10-19): *"falta agregar un mapa para poder visualizar la ruta del tecnico, parecido al mapa donde se visualizan los tecnicos"*, con la restricción de **no** gastar en llamadas a la API de Google Maps.

## Acceptance criteria
- [x] **T1**: el poll de 15 s **no** dispara llamadas a `/api/maps/distancia`; la ETA es local y hay un test que lo comprueba. Evidence: `0f34fb8` (+179/−42, 5 archivos): nuevo `distancia-local.ts` (haversine + `VELOCIDAD_MEDIA_KMH = 25`, **extraído del duplicado** que estaba en `maps-api.ts`), `seguimiento-ot-page.ts` sin `MapsApi` ni `calcularRuta`; spec con `HttpTestingController` real + `http.expectNone('/api/maps/distancia')` + spy (el writer reintrodujo la llamada y los tests fallaron → revertido). Suite 621/0; `tsc` 0; `eslint` 0.
- [x] **T1-bis**: el mismo leak en `ejecucion-ot-page.ts:84` (4 llamadas/min **por técnico**). Evidence: `4de9904`; reusa el módulo de T1 sin duplicar la fórmula; `ultimaPosicion` pasó a signal. Suite 624/0; `tsc` 0; `eslint` 0.
- [x] **T2**: `GET /api/config/maps` responde con centro/bounds/zoom desde el backend; el front usa esa config y deja de duplicar constantes. Evidence: `ea0ca21` (backend, 11 archivos) + `9c4783d` (frontend, 27 archivos). Endpoint **público** (como `actuator/health`, con allowlist en `RutasPublicas`) porque login/registro dibujan mapa sin sesión; devuelve `apiKey` **solo** la de navegador (`app.maps.browser-api-key`; la del server nunca sale y la IT lo asserta), `centro` (`app.maps.centro-lat/lng`, con `app.tarifa.centro-*` heredando la misma fuente), `bounds`, `zoom` y `radio*Km`. El front lo consume con `mapa-config.service.ts` (fallback único `CONFIG_POR_DEFECTO`); **eliminados** `cucuta.constant.ts`, `MapsApi.distancia` y `calcularRuta` (y sus specs). Backend 124/844/0; frontend 72/627/0; `tsc` 0; `eslint` 0. Grep final: **cero** referencias al código muerto (solo los guards `expectNone`).
- [x] **T3**: en la vista de seguimiento se ve el técnico moviéndose, el destino y la línea recta, también en `EN_CAMINO`, sin llamadas a Maps por tick. Evidence: `54e6378` (7 archivos, +533/−60): nuevo componente lean `shared/mapa-seguimiento/` + extracción de estilos/marcadores desde `mapa-radar` (radar **byte a byte idéntico**) + wiring en la página + 4 tests. **Cero llamadas a Maps**: posición del poll existente, destino desde `orden.punto`, ruta = línea recta de 2 puntos, distancia con `rutaLocal`. Reusa `GoogleMapsLoaderService` (**single-flight**), `MapaConfigService` (cero números hardcodeados) y los estilos del radar. Suite 73/640/0; `tsc` 0; `eslint` 0. Decisiones: componente lean nuevo en vez de extender `mapa-radar` (está atado al radar) —copió el patrón de `selector-ubicacion-mapa`—; sin posición → **sin marcador, sin línea y sin números**; accesibilidad: distancia/ETA en texto y `aria-live="polite"` en el componente.
- [x] **T4**: la respuesta de la OT expone `llegadaEn` y el cliente lo ve sin recargar. Evidence: `llegadaEn` (nullable, ISO-8601) viaja en `OtResponse`/`OtApiResponse` y en el front (opcional). La llegada es un HECHO y no una transición (SRS 5.2 no tiene `EN_LLEGADO`), así que nunca produjo `CambioEstado` y el drain loop no la publicaba: nuevo evento de dominio `OtLlegadaConfirmada` (publicado por `ConfirmarLlegadaUseCase` **solo la primera vez**, para que el reintento idempotente no despierte el stream) + `OtLlegadaConfirmadaSseListener`, que publica en la **misma clave y el mismo evento** (`ot-estado-cambiado`) que el front ya consume, con `origen == destino == EN_CAMINO` (deliberado: la llegada no cambia el estado; el dato nuevo es el instante). Sin canal ni endpoint nuevos, sin tocar la idempotencia. Verificado con un IT que **suscribe un cliente antes de la llegada** y comprueba que el stream trae el evento, y con un IT que comprueba `llegadaEn` en la respuesta (y su ausencia antes). Backend 125/849/0; frontend 628/0; `tsc` 0; `eslint` 0.
- [x] **T4-bis**: la página **muestra** la llegada. Evidence: `394462d` (2 archivos, +44/−6): la línea de estado de la tarjeta del técnico dice **"El técnico llegó {fecha}"** cuando `orden.llegadaEn` está y **reemplaza** el "En camino… (ETA)" (si no, la página se contradiría: "llegó" + "ETA 6 min"); la fila lateral "Llegada estimada" se oculta también; región viva siempre presente (`aria-live="polite"`) → se anuncia sin robar el foco; **sin llegada, ninguna línea**. Cero cambios de TS (la plantilla lee `orden.llegadaEn` de la OT que la página ya tiene). Suite 641 → 643; `tsc` 0; `eslint` 0.
- [ ] **T5**: suites verdes + verificación independiente.

## Tasks
- [x] T1 (frontend, delegated): quitar la llamada a Maps por tick. Route: delegated-direct. Evidence: `0f34fb8` + T1-bis `4de9904` (ejecución del técnico). Sin callers de producción de `calcularRuta` ni de `MapsApi.distancia` (el endpoint del backend sigue vivo: lo usa para estimar tarifa).
- [x] T2 (backend+frontend, delegated): `GET /api/config/maps` + consumo de la config. Route: delegated-direct (2 commits: `ea0ca21` backend, `9c4783d` frontend).
- [x] T3 (frontend, delegated): mapa de seguimiento. Route: delegated-direct. Evidence: `54e6378`.
- [x] T4 (backend, delegated): `llegadaEn` + evento SSE. Route: delegated-direct. Evidence: `cc23cd9` (rama `feat/mapa-t4-backend`, mergeada en el feature).
- [x] T4-bis (frontend, delegated): render de la llegada en la página. Route: delegated-direct. Evidence: `394462d`.
- [ ] T5 (parent): verificación final + reporte.

## Delivery
- Forecast: ~350–550 líneas. Estrategia `ask-on-risk` (default): al superar ~400 se decide con el usuario. Rama única, sin cadena.

## Progress
- 2026-10-19: doc creado tras el mapeo del flujo de mapas (T1–T4 identificados con `path:line`).
- 2026-10-19: T1 DONE (`0f34fb8`): la distancia/ETA del cliente deja de llamar a Google en cada tick. Opción: **cálculo local** (haversine + 25 km/h), no "una llamada con cache" (esa igual gastaba cuota y dejaba el número viejo mientras el técnico se mueve). La fórmula replica la del backend (`CalculadoraHaversine`, r=6371). Verificado con un test que muerde (reintrodujo la llamada → falló) y por el parent: 71/621/0.
- 2026-10-19: T1-bis DONE (`4de9904`): el mismo leak en `ejecucion-ot-page.ts:84`. Suite 624/0.
- 2026-10-21: T2 DONE (`ea0ca21` + `9c4783d`): config de mapa servida por el backend, duplicaciones eliminadas, código muerto borrado. Verificado por el parent (front) y por el writer (backend 124/844/0 con baseline medido en un worktree descartable: 122/836). Precedencia de la key intacta (`google-maps-loader.ts:135-139`: primero la key de build, el endpoint de config solo como fallback) → el mapa no se rompe si `app.maps.browser-api-key` no está configurado.
- 2026-10-21: T3 DONE (`54e6378`): mapa de seguimiento con el técnico moviéndose, destino y línea recta, también en `EN_CAMINO`. Suite 73/640/0; `tsc` 0; `eslint` 0.
- 2026-10-21: T4 DONE (`cc23cd9`, merge `cb8a387`): `llegadaEn` expuesto + evento SSE en la clave/evento que el front ya consume, sin canal ni endpoint nuevos. Backend 125/849/0; frontend 628/0.
- 2026-10-21: T4-bis DONE (`394462d`): la tarjeta del técnico dice "El técnico llegó {fecha}" y **reemplaza** el "En camino… (ETA)"; la fila lateral "Llegada estimada" se oculta; región viva siempre presente; sin llegada, ninguna línea. Suite 641 → 643; `tsc` 0; `eslint` 0. Deuda cosmética anotada: la app no registra `LOCALE_ID` → las fechas salen en `en-US` dentro de textos en español (preexistente, decisión app-wide del usuario).
