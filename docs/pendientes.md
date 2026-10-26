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

### 2.2 Quitar el registro de proveedores desde la parte de admin — **S** (CERRADO 2026-10-22)

Cerrado en main (merge 5bf2d47, PR #60). Rama feat/admin-proveedores-validacion (2 commits). Integracion en main: 74 archivos / 671 tests / 0 fallos. Doc del feature: odd/tasks/admin-proveedores-validacion.md. El admin ya no da de alta proveedores; ahora valida la documentacion.
- Mapeo: `POST /api/proveedores` **es** el auto-registro público (`permitAll`), y la UI pública ya lo usa desde `registro-page`. El formulario del admin lo duplicaba.
- Se fue el alta completa del panel (form + `AdminApi.crearProveedor`, que quedó sin consumidores ni tests).
- Se quedó la validación documental, que el backend ya tenía y el admin no exponía: `PATCH /api/proveedores/{id}/validacion` vía `ProveedoresApi.validarDocumentacion`. El listado muestra `estadoValidacion` y permite aprobar / rechazar con motivo (modal con `minLength 5`, patrón de `validacion-tecnicos-page`).
- Ojo: en modo mock `validarDocumentacion` es un no-op documentado, así que validar no cambia el badge hasta hablar con el backend real.

### 2.3 Filtro de OTs en la parte del cliente — **S** (CERRADO 2026-10-22)

Cerrado en main (merge cd9b885, PR #59). Rama feat/filtro-ots-cliente (2 commits). Frontend 73 archivos / 662 tests (+9) en su rama. Doc del feature: odd/tasks/filtro-ots-cliente.md. El cliente ya puede ver todas sus OTs, no solo las activas.
- Filtro **en el front**: el panel ya trae todas las OTs del cliente, no hizo falta query param.
- 4 vistas: `Todas` / `Activas` (default, la de hoy) / `Completadas` / `Sin técnico` (`!tecnicoId && estado !== 'CANCELADA'`). Las completadas antes solo existían como contador; ahora se listan.
- Los contadores de las métricas **no** siguen el filtro.

### 2.4 Repuestos (insumos) para proveedores + que el técnico los agregue desde su OT — **M/L** (CERRADO 2026-10-26)

Cerrado en main (merges 4ae81d5 PR #62 backend + a8e5a04 PR #63 frontend, apilados). Ramas feat/insumos-backend (5 commits) + feat/insumos-frontend (4). Backend 130 suites / 887 tests. Frontend 75 archivos / 696 tests en la integración de main. Verificación: verificador independiente PASS (1 minor cerrado; la review nativa fue no transitable en este runtime: `immutable_review_transport_unsupported`). Doc del feature: odd/tasks/insumos-repuestos.md. El técnico ya puede pedir repuestos desde su OT fuera del diagnóstico; el proveedor quedó con tests.
- Mapeo corregido contra el código: **no existe entidad `Insumo` ni catálogo** (decisión del dominio en `RequerimientoInsumo`); la UI del proveedor **ya existía** (`solicitudes-proveedor-page`) y el faltante real era el flujo del técnico a posteriori. Sin catálogo nuevo.
- Backend: `POST /api/ot/{id}/insumos` (estados permitidos `ASIGNADA/EN_CAMINO/EN_DIAGNOSTICO/EN_REPARACION/DISPUTADA`; 403 del técnico asignado dispara antes del 409 en estados sin técnico; retriable tras `SIN_PROVEEDOR`) + `GET /api/ot/{id}/insumos` (newest first). Reusa `SolicitarInsumoUseCase`: mismo broadcast por proveedor activo, misma vigencia, misma rama `SIN_PROVEEDOR`.
- Frontend: sección "Repuestos" en `ejecucion-ot-page` (líneas libres como el diagnóstico, guard in-flight anti doble broadcast, copy humana en toda la ruta de error) + primera spec de `solicitudes-proveedor-page` (10 tests).
- Nits documentados (no bloquean): 201 `Location` apunta a la colección; sin idempotencia backend por diseño — el debounce vive en la UI.

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
3. ~~Los dos baratos: **filtro de OTs del cliente** (2.3) y **quitar el registro de proveedores en admin** (2.2).~~ HECHO y mergeado 2026-10-22 (#59, #60).
4. ~~**Repuestos/insumos** (2.4)~~ HECHO y mergeado 2026-10-26 (#62 backend + #63 frontend, apilados).
5. **Preparación Ionic + revamp Stitch** — ver §5: quickwins web primero, después backend móvil, revamp de pantallas cliente/técnico con Stitch (admin queda en Angular web).

## 5. Preparación Ionic + revamp Stitch (NUEVO 2026-10-26)

**Corte de superficies propuesto:** Ionic móvil = **cliente + técnico**. El **panel admin queda en Angular web** (comodidad del cliente, pantallas densas, teclado). Proveedor: pendiente decidir (ver preguntas abajo). Común: auth, SSE, servicios, config con `API_ORIGIN` inyectable.

### 5.1 Blockers de arquitectura móvil (antes de migrar)
- [ ] **B1** (`S`) backend: CORS aceptar schemes `capacitor://` / `file://` (`SecurityConfig.java:134-144`).
- [ ] **B2** (`S`) frontend: `API_ORIGIN` inyectable en `api.config.ts` (hoy relativo `'/api'` → roto en Capacitor) + build del workspace móvil.
- [ ] **B3** (`M`) backend: `GET /api/usuarios/me` + `nombre` en JWT (`JwtTokenIssuer.java:44-52`, hoy sin nombre y sin `/me` → la app móvil no puede mostrar "Bienvenido, X").
- [ ] **B4** (`S`) verificar: Maps key con restricciones para origin nativo; `EventSource` no sobrevive en background (el poll de respaldo cubre).

### 5.2 Bugs que bloquean el móvil
- [ ] **B5** (`S`) **técnico no puede pedir una orden**: `POST /api/ot` exige perfil Cliente y tira "No existe un perfil de cliente para el usuario: 1". Fix frontend: detectar ese error al crear OT → guiar a `agregar-perfil-page` (la página y el endpoint `POST /api/clientes/perfil` ya existen). Verificar el flujo dual-role del registro mientras.
- [ ] **B6** (`S/M`) mensajes crudos del backend en 12+ sitios: adoptar `mensajeErrorAccion` (baseline del fix de `errores-silenciosos-acciones`). Sitios: `seguimiento:347,367`, `panel-tecnico:155`, `pago-acta:252`, `calificar:65`, `solicitar:193`, `login:55`, `registro:196`, `mi-perfil:126`, `agregar-perfil:144`, `selector-ubicacion:128`, `solicitudes-proveedor:143`.
- [ ] **B7** (`S`) carga de OT en silencio: `ot-carga.ts:41` sin error → 5 páginas en blanco. Estado de error con reintento (mismo patrón de la sección Repuestos).
- [ ] **B8** (`S`, web only) cargas admin silenciosas ×6 (dashboard, monitoreo, consignaciones, validación, disputas, proveedores): pasa por `next:` sin error.
- [ ] **B9** (`S`, decisión del usuario) `LOCALE_ID` es-CO: afecta todas las fechas de la app.
- [ ] **B10** (`S`) polls sin visibilidad gate: ubicación 15 s (`seguimiento`) y poll de OT (`ot-api.ts:139` enmascara 404 **y 401/5xx**): batería en móvil.
- [ ] **B11** (`S`) 401 doble aviso (interceptor to + tira la página). Dejar un solo toast.
- [ ] **B12** (`M`) **"Mis equipos" renovación funcional**: hoy `historial-equipos-page` es **hardcoded con datos imaginarios en ambos modos**. Fuente real existe: `ClientesApi.getOtsPorCliente` → derivar equipo por categoría + descripción de falla + última OT (fecha, técnico, estado, garantía/acta) + link al seguimiento. Sin backend nuevo.
- [ ] **B13** (`S`) chat de diagnóstico **fake**: auto-responde en modo real (`diagnostico-ot-page.ts:169-186`) → quitar o ocultar tras banner "próximamente".
- [ ] **B14** (`S`) defaults falsos pre-pobla-dos: diagnóstico (`ejecucion:108-116`), comprobante (`liquidaciones:66-67`), 5 estrellas default (`calificar:28-29`).

### 5.3 UX dual-role: buscar ofertas vs pedir una orden
- [ ] **B15** (`M`) el mismo usuario puede ser cliente y técnico, y el UI no distingue el contexto. Propuesta: **selector de rol activo** (chip de "Modo cliente / Modo técnico" en app móvil) + reglas de navegación: "Solicitar servicio" solo visible en modo cliente, "Ofertas/Radar" solo en modo técnico, y el panel redirige según el modo elegido, no solo por rol primario. Además copy del radar: explicar que la oferta es broadcast al primer técnico que acepta (no pedido directo). Evita la confusión que originó B5 y que cualquiera se equivoque de contextos.
- [ ] (Designer) Necesito confirmación del flujo: ¿existe "solicitud directa a un técnico concreto" hoy (técnicos cercanos) o todo es broadcast? Si la directa no existe, documentarla como fuera de alcance.

### 5.4 Revamp UI mobile con Google Stitch
Screens a rediseñar (inventario del audit 2026-10-26):
- **Cliente (Ionic):** login · registro · agregar-perfil · panel (Mi equipo cards + OT activa) · solicitar (mapa + dirección) · seguimiento (mapa + historial) · diagnóstico/aprobar-presupuesto · pago-acta · calificar.
- **Técnico (Ionic):** panel-ofertas (radar) · aceptación de oferta · ejecución OT (diagnóstico, repuestos, acta, firma) · perfil + documentos.
- **Admin (web, fuera de este revamp):** luego, cuando el móvial salga.

Lo que entrego para Stitch:
1. **Stitch prompt pack por pantalla**: lista de componentes, estados (empty/error/carga/succeso), datos reales y bindings correspondientes al DTO existente (sin inventar campos), contra folder/app/admins-existing.
2. **Token set actual** para consistencia: `sky-600` primario, `amber` acciones pagas, `violet` repuestos, `slate` fondo/mdo, `PrimeNG` toasts.
3. **Criterios de aceptación**: toda pantalla Stitch ↔ ruta Angular + contrato API real; pantalla sin binding real (reporte) → cortar o achicar.

**Necesito del usuario (para el prompt pack):**
1. Identidad: ¿logo/nombre de marca? ¿mantener paleta actual (sky/amber/slate) o paleta nueva?
2. ¿Proveedor entra a Ionic o queda web?
3. ¿Referencias de estilo (screenshots) o diseñamos sobre padrão Ionic native-style?
4. Aprobar el prompt pack y el orden de pantalla (cliente primero o técnico primero).
5. Los de la sección 3 según impacto (3.1 el crudo y 3.2 los loads son los que más se ven).
