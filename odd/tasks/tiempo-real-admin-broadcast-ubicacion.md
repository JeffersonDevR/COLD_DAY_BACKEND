# Feature: tiempo-real-admin, broadcast y ubicacion automatica

## Objetivo
Cerrar los 4 pendientes operativos elegidos el 2026-10-30: (1) panel admin en tiempo real por SSE, (2) broadcast como unica modalidad de asignacion + navegacion dual-role coherente, (3) ruta real por calles con costo medible, (4) ubicacion del tecnico ligada al ciclo de vida de la OT (sin boton incomodo).

## Decisiones del usuario (2026-10-30)
- **Asignacion = broadcast puro**. No existe ni se implementa "solicitud directa a un tecnico". El copy del radar debe explicarlo.
- Admin SSE: se termina.
- PanelRedirect: se corrige.
- Maps `directions`: se implementa para medir costo real.
- Ubicacion: se integra al ciclo de vida de la OT.

## Patrones existentes a reutilizar (verificados)
- `SseEmitterRegistry` (in-memory, key→emisores, heartbeat 15 s, timeout 30 min) + `SseTicketService` (ticket single-use, TTL 30 s) + `POST /api/sse/ticket`. Streams son `permitAll` en el filter chain porque `EventSource` no manda `Authorization`.
- Listeners `@TransactionalEventListener(AFTER_COMMIT, fallbackExecution=true)` en `ot/infrastructure/listeners/`; advices por controller con `Ordered.HIGHEST_PRECEDENCE` devolviendo JSON.
- Eventos de administracion ya publicados y **sin consumidores**: `DisputaAbierta/Resuelta`, `ComprobanteCargado`, `LiquidacionRegistrada/Aprobada/Rechazada`; de tecnicos: `TecnicoValidado`, `TecnicoValidacionRechazada`. `ProveedorValidado` NO existe (fuera de alcance).
- `SseService` frontend duplica ~80 lineas de backoff por canal: el tercer canal obliga a extraer un helper privado generico (API publica intacta).
- `mapa-seguimiento` dibuja `map-polyline` de 2 puntos (`mapa-seguimiento.ts:77-85`); `google.maps.geometry.encoding.decodePath` ya esta cargado (`libraries=geometry,places`).
- `MapsPort` tiene 4 operaciones, sin Directions ni cache; el proxy no tiene rate limit.
- `TecnicoTrackingService` solo lo arrancan `panel-tecnico` (manual) y `ejecucion-ot` (auto); `ejecucion` lo detiene en `ngOnDestroy`, asi que salir de la pagina apaga el reporte aunque el panel lo haya activado.
- Radar (`PostgisTecnicoDisponibilidadAdapter`) filtra por `activo`, validacion, `DISPONIBLE` y radio, **pero no** por `tracking_activo` ni vigencia de ubicacion (2 min). Un tecnico que detuvo el reporte sigue apareciendo.

## Checklist

### A. Panel admin en tiempo real
- [ ] **A1 (backend)** — canal `GET /api/admin/stream`: ticket→principal con rol ADMINISTRADOR, key unica `admin`, regla `permitAll` **antes** de `/api/admin/**` en `SecurityConfig`. Listener unico con un metodo por evento (disputas, comprobantes, liquidaciones, validaciones) publicando `admin-actividad` con `{tipo, id, ocurridaEn}`. ITs: 401 sin ticket, 403 no-admin, admin recibe evento de disputa y de liquidacion.
- [ ] **A2 (frontend)** — `SseService`: extraer helper generico (backoff/ticket/parseo) y exponer `abrirAdminStream()`; API publica existente sin cambios. Páginas admin (dashboard, disputas, consignaciones, validación) recargan con debounce al recibir evento relevante; sin doble carga ni tormenta. Specs por página + servicio.

### B. Broadcast y navegacion dual-role
- [x] **B1** — copy del radar/panel tecnico explicando broadcast ("tu oferta se envia a los tecnicos cercanos; el primero que acepta la toma"). Documentar "solicitud directa" como fuera de alcance en `docs/pendientes.md`. Sin cambio funcional de asignacion.
- [x] **B2** — resolver unico de panel (`PanelResolver`): preferencia persistida (`coldday.panel.preferido`) escrita al visitar un panel, usada por `panel-redirect` y por "Mi Panel" del topbar; fallback rol primario → primer rol con panel. Specs de los 3 casos (preferencia valida, invalida, sin preferencia).

### C. Ruta real por calles (costo medible)
- [x] **C1 (backend)** — `POST /api/maps/ruta` {origen, destino} → {distanciaKm, duracionMin, polyline}: `MapsPort`+adapter sobre Directions API, cache en memoria (TTL 60 s, max 200 entradas, clave por coords redondeadas), sin llamada si Maps no esta disponible (fallback nulo, como `distanciaOpcional`). Tests de parseo, cache hit y caida. Sin ruta (`ZERO_RESULTS`/`NOT_FOUND`) = resultado vacio: el endpoint responde 404 (mismo criterio que `/distancia`) y `rutaOpcional` colapsa a vacio.
- [x] **C2 (frontend)** — `mapa-seguimiento` dibuja el polyline decodificado cuando hay ruta; fallback a linea recta si falla. Guard de costo en `RutaSeguimientoService` (page-scoped): pedir solo con pestaña visible, solo con tecnico en movimiento, como maximo 1 request cada 60 s o cuando el tecnico se movio >200 m. `MapsApi.ruta` colapsa 404/502/503 a `null` (el mapa nunca depende de Google). Specs de decodificacion, fallback, guard y contrato HTTP.

### D. Ubicacion ligada al ciclo de vida
- [x] **D1 (frontend)** — reporte automatico mientras hay OT en movimiento (panel tecnico al cargar con OT activa + ejecucion ya existente), sin boton; el toggle del panel queda solo para `DISPONIBLE` ("compartir ubicacion para recibir ofertas"), persistido en `localStorage` y restaurado al abrir la app. Se detiene al terminar/cancelar. (politica unica `TecnicoPresenciaService`, commit `3d25779`; sin endpoints nuevos)
- [ ] **D2 (backend)** — el radar respeta `tracking_activo` y vigencia de ubicacion (2 min) en `PostgisTecnicoDisponibilidadAdapter`; test de tecnico con tracking detenido o ubicacion vieja que NO aparece.
- [x] **D3** — specs de ciclo (inicio automatico, stop al finalizar, toggle persistido) + verificacion completa. (frontend 81 archivos / 870 tests / 0, tsc app+spec exit 0, lint solo los 8 pre-existentes)

## Criterios de aceptación
1. Un admin ve disputas/liquidaciones/validaciones aparecer sin recargar ni pollear.
2. Ninguna pantalla sugiere pedido directo a un tecnico; el radar explica broadcast.
3. `/panel` y "Mi Panel" llevan al panel que el usuario uso por ultima vez, sin importar el rol primario.
4. La ruta del tecnico se dibuja por calles con un maximo de 1 request por minuto mientras la pestaña esta visible; si Google falla, se ve la linea recta.
5. Un tecnico ejecutando una OT reporta ubicacion sin tocar nada; uno disponible controla su visibilidad con un switch que sobrevive al refresh; uno inactivo no aparece en el radar.

## Fuera de alcance
- `ProveedorValidado` / eventos de proveedores (no existen; requiere modulo nuevo).
- Migracion fisica a Ionic y selector "Modo cliente/tecnico" (van con el shell movil).
- Registry SSE distribuido (Redis): sigue siendo in-memory, 1 instancia.
- Rutas con trafico en tiempo real o alternatives >1.

## Verificacion
- Backend: suites targeted + completa (baseline 132 suites / 914 tests / 0).
- Frontend: `npm test -- --watch=false` (baseline 78 / 789 / 0), tsc app+spec, lint solo los 8 pre-existentes, build.
- Verificador independiente por slice (review nativa no transitable en este runtime).
