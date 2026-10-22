# Pendientes

Todo lo que falta para completar el trabajo, con lo ya verificado en código (`path:line`) y el tamaño estimado. Se va marcando a medida que se cierre; lo `[ ]` es lo que queda.

Estado: 2026-10-19.

## 1. ✅ Cerrado — mapa de la ruta del técnico

Rama `feat/mapa-ruta-tecnico` (desde `origin/main`), **pusheada y sin PR**. Doc del feature: `odd/tasks/mapa-ruta-tecnico.md`. Verificación independiente: **VERIFIED** (cuota, mapa, endpoint público, llegada e higiene) + 1 defecto menor cerrado.

**Lo que queda de tu lado:** probarlo en la app (el render real del mapa no se ejercitó en navegador) y mergear la rama.

- [x] **T1** (`0f34fb8`) — la distancia/ETA del cliente deja de llamar a Google Maps en cada tick de 15 s → cálculo local (`distancia-local.ts`, haversine + 25 km/h, la misma fórmula que el backend). Test con `HttpTestingController` real (`expectNone('/api/maps/distancia')`).
- [x] **T1-bis** (`4de9904`) — el mismo leak en `ejecucion-ot-page.ts:84` (4 llamadas/min **por técnico**).
- [x] **T2** (`ea0ca21` backend + `9c4783d` frontend) — `GET /api/config/maps` **público** con `apiKey` (solo la de navegador), `centro`, `bounds`, `zoom` y `radio*Km`; el front lo consume con `mapa-config.service.ts`; **eliminados** `cucuta.constant.ts` (las 6 duplicaciones) y el código muerto `MapsApi.distancia` + `calcularRuta` (sus specs también). Backend 124/844/0 · frontend 72/627/0 · `tsc` 0 · `eslint` 0. Rama `feat/mapa-ruta-tecnico` **pusheada** (sin PR). Lo que quedó duplicado y por qué está en el doc del feature.
- [ ] **T3** — el mapa de seguimiento: marcador del técnico moviéndose (poll existente de 15 s, **sin llamadas a Maps**), destino y línea recta, y **visible también en `EN_CAMINO`** (hoy el mapa del cliente solo existe en `SOLICITADA|BUSCANDO_TECNICO` → `seguimiento-ot-page.html:151-161`). `mapa-radar` está acoplado al radar (4 círculos, sweep, timer): reutilizar `GoogleMapsLoaderService`, `CUCUTA_METRO_BOUNDS` y los estilos, no el componente tal cual. La librería `geometry` ya se pide en el loader.
- [ ] **T4** — exponer `llegadaEn` en la respuesta de la OT + evento SSE → el cliente ve "el técnico llegó" sin recargar. Hoy `Ot.confirmarLlegada` (EN_CAMINO, idempotente) la fija pero **no está en ninguna respuesta de la API**.
- [x] **T5** — verificación final del feature: **VERIFIED** por el verificador independiente (1 defecto menor —el badge decía "En camino:" junto al "El técnico llegó"— cerrado en `7ff01fb`; 4 nits documentados). Suite frontend 73/644/0 · backend 125/849/0.

**Decisiones ya tomadas (no reabrir sin motivo):** cero llamadas nuevas a Google Maps; la "ruta" es una **línea recta** al destino y la ETA es **local** (`round((km/25)×60)`) → es una **cota inferior**, optimista frente a Google; **Directions API fuera de alcance** (el scope de la key no es verificable y costaría por viaje); la **geo-arrival automática** fuera de alcance (la llegada sigue siendo manual: `POST /api/ot/{id}/llegada`).

## 2. Las 4 features pedidas el 2026-10-19

### 2.1 Alertas en los momentos importantes de la OT — **M** (CERRADO 2026-10-22)

Cerrado en main (merge 363b83d). Rama feat/alertas-ot (8 commits). Backend 127 suites / 856 tests. Frontend 73 archivos / 653 tests. Verificacion independiente PASS (2 majors cerrados). Doc del feature: odd/tasks/alertas-ot.md. Historial ahora llega al cliente, pago de la visita emite evento, se anuncian 4 alertas mas Visita pagada para el tecnico.
- Momentos pedidos: el técnico acepta una orden, el cliente paga la visita, el cliente paga/el técnico envía el presupuesto, y otros.
- Los eventos de dominio **ya existen** (no hay que inventar el modelo): `OtCreada`, `OtAsignada`, `OtFinalizada`, `OtCancelada`, `LiquidacionRegistrada/Aprobada/Rechazada`, `ComprobanteCargado`, `DisputaAbierta/Resuelta`.
- Lo que falta: **bridges SSE por OT** (el patrón ya está en `OfertaCreadaSseListener` / `OtEstadoCambiadoSseListener`) + el aviso en la UI del cliente y del técnico (toast/aviso en la página de seguimiento, en la de ofertas y en la del técnico).
- Ojo: el **envío del presupuesto** no tiene evento propio → hay que emitirlo o derivarlo de `OtEstadoCambiado`.
- Se reusa el canal por técnico ya construido (`tecnico:{id}`, `GET /api/tecnicos/me/ofertas/stream`).

### 2.2 Quitar el registro de proveedores desde la parte de admin — **S** (PR ABIERTO 2026-10-22)

Rama `feat/admin-proveedores-validacion` (2 commits, c40f1ee + 752cc0d). Frontend 74 archivos / 661 tests. Doc: `odd/tasks/admin-proveedores-validacion.md`.
Mapeo: `POST /api/proveedores` **es** el auto-registro público (`permitAll`), y la UI pública ya lo usa desde `registro-page`. El formulario del admin lo duplicaba.
- Se va el alta completa del panel de admin (form + `AdminApi.crearProveedor`, que quedó sin consumidores).
- Se queda la validación documental, que el admin **no** tenía en UI aunque el backend sí: `PATCH /api/proveedores/{id}/validacion` vía `ProveedoresApi.validarDocumentacion`. El listado ahora muestra `estadoValidacion` y permite aprobar / rechazar con motivo.

### 2.3 Filtro de OTs en la parte del cliente — **S** (PR ABIERTO 2026-10-22)

Rama `feat/filtro-ots-cliente` (2 commits, 5f084da + 4a1155c). Frontend 73 archivos / 662 tests (+9). Doc: `odd/tasks/filtro-ots-cliente.md`.
- Filtro **en el front**: el panel ya trae todas las OTs del cliente, no hizo falta query param.
- 4 vistas: `Todas` / `Activas` (default, la de hoy) / `Completadas` / `Sin técnico` (`!tecnicoId && estado !== 'CANCELADA'`). Las completadas antes solo existían como contador; ahora se listan.
- Los contadores de las métricas **no** siguen el filtro.

### 2.4 Repuestos (insumos) para proveedores + que el técnico los agregue desde su OT — **M/L**
- El dominio ya tiene `Insumo`, `OfertaInsumo`, `RequerimientoInsumo` y `oferta.requerimientoId` (que en T4 dejamos de exponer por ser un id interno).
- Falta la UI de insumos del proveedor y el flujo de que el técnico proponga/agregue repuestos desde su vista de la OT.

## 3. Pendientes acumulados de la sesión

- [ ] **Locale de fechas**: la app no registra `LOCALE_ID` → todas las fechas salen en `en-US` ("Oct 21, 2026, 3:30:00 PM") dentro de textos en español. Fix de 1 línea (`registerLocaleData` + `LOCALE_ID` es-CO) pero cambia el render de fechas de **toda** la app: decisión tuya.
- [ ] **Costo de Google Maps**: un segundo mapa renderizado es un *map load* facturable (a diferencia de Distance Matrix). Hoy no hay doble carga (el radar solo se renderiza cuando no hay técnico asignado), pero es el número a mirar si se superponen.

- [ ] **3 sitios que muestran el mensaje crudo del backend** al usuario: `seguimiento-ot-page.ts:275,295` y `panel-tecnico-page.ts:117` — misma clase de fuga que se corrigió en T4 (`err.message` crudo en vez de copy humano).
- [ ] **Clase de LOADS silenciosos**: `ot-carga.ts:42` (deja la página **en blanco**), `dashboard-admin-page.ts:56`, `diagnostico-ot-page.ts:85`, `pago-acta-page.ts:95`, `ejecucion-ot-page.ts:185`, `seguimiento-ot-page.ts:133`, y el poll de ubicación que **muere en silencio** cuando el backend responde 404 (`seguimiento-ot-page.ts:202`).
- [ ] **El tablero admin no se actualiza nunca**: disputas, consignaciones, liquidaciones y validación de técnicos (no hay bridges para `DisputaAbierta/Resuelta`, `Liquidacion*`, `ComprobanteCargado`, `TecnicoValidado`) → requiere un canal `admin` (M/L).
- [ ] **`OtSinTecnicosDisponibles` no se emite** (`EscalarRadioUseCase:104`): el estado queda `BUSCANDO_TECNICO` y el cliente no ve que el radio creció.
- [ ] **El nombre propio del usuario**: el JWT no lo trae (`TokenResponse` = token/expiracion/rol/roles) → requiere backend (agregar `nombre` al token o un `/api/usuarios/me`).
- [ ] **Batería**: `ejecucion-ot-page.ts:131` reporta ubicación aunque el técnico esté solo `DISPONIBLE` (no ejecutando).
- [ ] **Botón de reportar ubicación**: el diseño de `tecnico-activar-ubicacion` (reportar para aparecer en el radar, sin OT) es incómodo; el live tracking debería alimentarse del ciclo de vida de la OT.
- [ ] **Navegación a `/panel`**: `PanelRedirectComponent` sigue eligiendo por **rol primario** → un dual-role puede no llegar al panel de técnico por esa vía (el botón "Mi Panel" ya se corrigió en `2c2bf0a`).
- [ ] **Registry SSE en memoria**: con más de una instancia en Railway, un evento publicado en una no llega al cliente de otra. Hoy corre 1 instancia.
- [ ] **El proxy `/api/maps` no tiene `directions`**: si alguna vez se quiere la ruta real por calles, hay que habilitar el scope en la key y pagar por viaje.

## 4. Orden sugerido

1. Cerrar el feature del mapa (T2 → T5) — es el que pediste en primer lugar.
2. **Alertas de la OT** (2.1) — reusa el canal SSE ya construido; es el mayor valor por esfuerzo.
3. ~~Los dos baratos: **filtro de OTs del cliente** (2.3) y **quitar el registro de proveedores en admin** (2.2).~~ HECHO 2026-10-22 — PRs abiertos, falta merge.
4. **Repuestos/insumos** (2.4) — toca el mismo dominio de ofertas que el mapa. **Siguiente.**
5. Los de la sección 3 según impacto (3.1 el crudo y 3.2 los loads son los que más se ven).
