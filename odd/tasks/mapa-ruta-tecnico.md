# Feature: mapa-ruta-tecnico

## Objective
Que el cliente vea al técnico moverse y dónde va, **sin recargar** y **sin gastar cuota de Google Maps**: mapa de seguimiento en la vista de OT con el técnico en vivo, la "ruta" al destino y una ETA local.

## Problem (mapeo verificado 2026-10-19)
1. **Quota**: `seguimiento-ot-page.ts:221-253` hace el poll de posición del técnico cada 15 s y **en cada tick llama `POST /api/maps/distancia`** (Distance Matrix de Google). Con un técnico en movimiento y un cliente mirando: **4 llamadas/minuto por cliente**. Es el gasto que hay que eliminar.
2. **No hay mapa en el momento que importa**: el `<app-mapa-radar>` solo se renderiza en `SOLICITADA|BUSCANDO_TECNICO` (`seguimiento-ot-page.html:151-161`). En `EN_CAMINO` **no hay mapa**, y **no existe ningún marcador del técnico**.
3. **No hay Directions en el proxy**: `MapsController` expone `estado`, `geocode`, `inversa`, `autocompletar`, `distancia` (upstream `distancematrix/json`). **No hay `directions`/`routes`** y el scope de la key no es verificable → la ruta NO se puede depender de la API de Google.
4. **Constantes duplicadas**: `cucuta.constant.ts:11,17-22`, `mapa-radar.ts:63-64`, `seguimiento-ot-page.html:156-157`, `registro-page.ts:163`, `environment.ts:39-42` vs backend `app.tarifa.centro-lat/lng` + `app.maps.*`.
5. **Key de Maps**: el loader usa la key de build (`maps-key.ts`) y si no, cae a `GET /api/config/maps` — **ese endpoint no existe** (404) → en dev no hay mapa.
6. **La llegada es invisible**: `Ot.confirmarLlegada` (EN_CAMINO, idempotente) fija `llegadaEn`, pero **`llegadaEn` no está en ninguna respuesta de la API** → el cliente no puede enterarse.

## Decisiones (para que no crezca el alcance)
- **Cero llamadas nuevas a Google.** La "ruta" es una **línea recta** al destino (2 puntos) y la ETA es **local** con el haversine que ya existe en el front (`maps-api.ts` ya lo usa en mock: `km/25·60`). La librería `geometry` ya se pide en el loader (`libraries=geometry,places`) → no hace falta pedir nada.
- **Sin Directions API** hasta que se verifique el scope de la key y se acepte el costo (quedaría como feature aparte).
- Se reutiliza lo que ya existe: `GoogleMapsLoaderService`, `CUCUTA_METRO_BOUNDS`, los estilos de `mapa-radar.mapOptions` y las fábricas de markers.

## Scope
- **T1 (frontend, S):** la distancia/ETA deja de llamar a Google en cada tick → cálculo local (haversine) o una llamada por viaje con cache en el front. Se elimina el gasto por tick.
- **T2 (backend+frontend, S):** centralizar la config de mapa: crear `GET /api/config/maps` (el loader **ya lo llama** y da 404) devolviendo centro/bounds/zoom desde `app.maps.*`/`app.tarifa.centro-*`; el front consume esa config en vez de las constantes duplicadas.
- **T3 (frontend, M):** mapa de seguimiento reutilizando el patrón de casa (loader + bounds + estilos): marcador del técnico moviéndose (poll existente de 15 s, **sin llamadas a Maps**), destino y línea recta; visible también en `EN_CAMINO`.
- **T4 (backend, S):** exponer `llegadaEn` en la respuesta de la OT + evento SSE → el cliente ve "el técnico llegó" sin recargar.
- **T5 (parent):** verificación final.

## Out of scope (documentado)
- **Directions API / polyline real de Google** (scope de key no verificable + costo por viaje): queda para un feature propio.
- **Geo-arrival automático** (umbral haversine/ST_DWithin que dispare la transición solo): hoy la llegada es manual (`POST /api/ot/{id}/llegada`). Se expone el dato; automatizarlo es otro slice.
- `ejecucion-ot-page.ts:131` reporta ubicación aunque el técnico esté solo `DISPONIBLE` (no ejecutando): afecta **batería**, no cuota de Maps — anotado como follow-up aparte.
- El resto del roadmap del usuario (alertas de OT, registro de proveedores en admin, filtro de OTs del cliente, repuestos) vive en `roadmap/implementaciones-2026-10-19`.

## Constraints
- Frontend: copy y comentarios en **español**; backend: inglés.
- TDD standard. Runners: frontend `npm test -- --watch=false` (**baseline 70 archivos / 613 tests**), `npx tsc -p tsconfig.app.json --noEmit` y `-p tsconfig.spec.json`, `npx eslint <tocados>` (8 errores preexistentes repo-wide); backend `cd backend && gradlew.bat test` (Docker).
- Un writer por tarea, secuencial. Rama `feat/mapa-ruta-tecnico` desde `origin/main`.
- Push / PR / merge: decisión del usuario.

## Authorized scope
Usuario (2026-10-19): *"falta agregar un mapa para poder visualizar la ruta del tecnico, parecido al mapa donde se visualizan los tecnicos"*, con la restricción de que **no** se gaste en llamadas a la API de Google Maps.

## Acceptance criteria
- [x] T1: el poll de 15 s **no** dispara llamadas a `/api/maps/distancia`; la ETA mostrada es local (o cacheada una vez por viaje) y hay un test que lo comprueba. Evidence: commit `0f34fb8` (+179/−42, 5 archivos): nuevo `distancia-local.ts` (haversine + `VELOCIDAD_MEDIA_KMH = 25`, **extraído del duplicado** que ya estaba dentro de `maps-api.ts`), `seguimiento-ot-page.ts` sin `MapsApi` ni `calcularRuta`; spec con `HttpTestingController` real + `http.expectNone('/api/maps/distancia')` + spy (el writer reintrodujo la llamada y los tests fallaron → revertido). Suite **71 archivos / 621 tests / 0 fallos**; `tsc` 0; `eslint` 0. Extensión **T1-bis** (`4de9904`): el mismo leak en `ejecucion-ot-page.ts:84` (el técnico quemaba ~4 llamadas/min) → cerrado con el mismo módulo, sin duplicar la fórmula. Suite **624 / 0**.
- [ ] T2: `GET /api/config/maps` responde con centro/bounds/zoom desde el backend; el front usa esa config y deja de duplicar constantes (las duplicaciones restantes quedan listadas).
- [ ] T3: en la vista de seguimiento se ve el técnico moviéndose, el destino y la línea recta, también en `EN_CAMINO`, sin llamadas a Maps por tick.
- [ ] T4: la respuesta de la OT expone `llegadaEn` y el cliente lo ve sin recargar.
- [ ] T5: suites verdes + verificación independiente.

## Tasks
- [x] T1 (frontend, delegated): quitar la llamada a Maps por tick. Route: delegated-direct. Evidence: `0f34fb8` + T1-bis `4de9904` (ejecución del técnico). **Ya no queda ningún caller de producción de `calcularRuta` ni de `MapsApi.distancia`** → quedan como código muerto (a eliminar; el endpoint del backend `/api/maps/distancia` sigue vivo y lo usa el backend para estimar tarifa).
- [ ] T2 (backend+frontend, delegated): `GET /api/config/maps` + consumo de la config. Route: delegated-direct.
- [ ] T3 (frontend, delegated): mapa de seguimiento. Route: delegated-direct.
- [ ] T4 (backend, delegated): `llegadaEn` + evento SSE. Route: delegated-direct.
- [ ] T5 (parent): verificación final + reporte.

## Delivery
- Forecast: **~350–550 líneas** (T3 es el grueso). Estrategia `ask-on-risk` (default): al superar ~400 se decide con el usuario (cadena vs single PR).

## Progress
- 2026-10-19: doc creado tras el mapeo del flujo de mapas (T1–T4 identificados con `path:line`).
- 2026-10-19: T1 DONE (`0f34fb8`): la distancia/ETA del cliente deja de llamar a Google en cada tick. Opción elegida: **cálculo local** (haversine + 25 km/h), no "una llamada con cache" (esa igual gastaba cuota y dejaba el número viejo mientras el técnico se mueve). La fórmula replica la del backend (`CalculadoraHaversine`, r=6371). Verificado por el writer con un test que muerde (reintrodujo la llamada → falló) y por el parent: 71/621/0, `tsc` 0, `eslint` 0.
- 2026-10-19: T1-bis DONE (`4de9904`): el mismo leak en `ejecucion-ot-page.ts:84` (4 llamadas/min por técnico). Reusa el módulo de T1 sin duplicar la fórmula; `ultimaPosicion` pasó a signal para que el effect reaccione al tick. Suite 624/0; `tsc` 0; `eslint` 0. Grep final: **sin callers de producción** de `calcularRuta` ni de `MapsApi.distancia` → código muerto, a eliminar (encomendado a T2; el endpoint del backend sigue existiendo porque el backend lo usa para la tarifa).
