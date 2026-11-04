# Feature: migracion-ionic — app COLD DAY móvil (Dark Ops)

## Decisión (2026-11-03)
**App Ionic nueva + core compartido.** No wrapper Capacitor sobre la UI web: el diseño de Stitch ("COLD DAY Dark ops app mobile", proyecto `1546876662301161963`) es una UI móvil nativa y se implementa tal cual. La web Angular actual queda como está (panel admin y mantenimiento).

## Design system extraído de Stitch
| Token | Valor |
|---|---|
| Modo | DARK |
| Fondo base | `#0b1220` |
| Texto | `#e2e8f0` |
| Primary | `#22d3ee` (cyan) |
| Secondary | `#f59e0b` (amber) |
| Tertiary | `#a78bfa` (violeta) |
| Headline | Space Grotesk |
| Body | Inter |
| Roundness | 8 (ROUND_EIGHT) |
| Iconografía | Material Symbols (outlined + filled) |
| Shell | safe-area insets, bottom nav, header con campana |

Nota de consistencia: el cyan del diseño difiere del sky `#0284c7` de la web. La app móvil usa `#22d3ee` como primary (decisión de diseño), la web no se toca.

## Inventario de pantallas (Stitch → ruta móvil → origen web)
| Stitch | Ruta móvil propuesta | Se reutiliza de web |
|---|---|---|
| A1 Login | `/login` | `login-page` + `AuthService` |
| A2 Registro | `/registro` | `registro-page` (3 roles) |
| A3 Mi cuenta y cambiar rol | `/cuenta` | **nuevo**: selector de modo (B15) |
| A4 Panel Cliente | `/cliente/panel` | `panel-cliente-page` |
| A5 Solicitar servicio Paso 1 | `/cliente/solicitar` | `solicitar-servicio-page` + draft + un-tap perfil |
| A6 Seguimiento de OT | `/cliente/ot/:id` | `seguimiento-ot-page` (SSE + mapa + poll 15 s) |
| A7 Diagnóstico y presupuesto | `/cliente/ot/:id/diagnostico` | `diagnostico-ot-page` |
| A8 Pago y acta de servicio | `/cliente/ot/:id/pago` | `pago-acta-page` |
| A9 Calificar servicio | `/cliente/ot/:id/calificar` | `calificar-servicio-page` |
| B1 Radar de ofertas | `/tecnico/ofertas` | `ofertas-page` + `mapa-radar` |
| B2 Mis OTs | `/tecnico/panel` (lista) | `panel-tecnico-page` |
| B3 Ejecución de OT | `/tecnico/ejecucion/:id` | `ejecucion-ot-page` + insumos |
| B4 Perfil técnico y matrículas | `/tecnico/perfil` | `mi-perfil-tecnico-page` + documentos |
| C1 Solicitudes de insumos | `/proveedor/panel` | `solicitudes-proveedor-page` |
| C2 Documentos del proveedor | `/proveedor/documentos` | `perfil-documentos-page` |
| **B0 Panel Técnico** (generada 2026-11-03) | `/tecnico/panel` (home) | `panel-tecnico-page` |
| **A10 Mis equipos** (generada 2026-11-03) | `/cliente/equipos` | `historial-equipos-page` |
| **A3.1 Completar perfil cliente** (generada 2026-11-03) | `/perfil/agregar` (one-tap) | `agregar-perfil-page` + draft |
| **B5 Liquidaciones técnico** (generada 2026-11-03) | `/tecnico/liquidaciones` | `liquidaciones-tecnico-page` |
| **C0 Panel Proveedor** (generada 2026-11-03) | `/proveedor/panel` (home) | `solicitudes-proveedor-page` (resumen) |
| Logo | — | asset |
| Heatmap de A9 | — | descartar (artefacto de Stitch) |

**Pantallas que siguen faltando** (generar cuando se definan): centro de notificaciones (la campana de A4/B0/C0), estados de error/offline globales, y confirmaciones de acciones destructivas (cancelar OT, rechazar oferta).

## Arquitectura (implementada en P0)
```
repo/
├── backend/                 # sin cambios
└── frontend/                # workspace Angular único
    ├── src/                 # app web actual (raíz del workspace)
    │   └── app/core/        # COMPARTIDO: services, models, guards, i18n (alias @core/*)
    ├── projects/mobile/     # NUEVA app Ionic + Capacitor
    │   └── src/app/         # shell, tabs, pantallas del inventario
    ├── capacitor.config.ts  # appId com.coldday.app, webDir dist/mobile/browser
    └── angular.json         # proyectos: app (web, default) + mobile
```
Regla: `src/app/core` no importa PrimeNG, Tailwind ni componentes de pantalla; la UI vive en cada app. Alias `@core/*` (relativo: `./src/app/core/*`) resuelto desde `frontend/`.
Nota Ionic 9: el export raíz `@ionic/angular` **es** el standalone (`@ionic/angular/standalone` no existe). No se agregó `zone.js`: el shell compila y corre zoneless; validar transiciones en dispositivo en P1.

## Fases

### P0 — Workspace único con core compartido (CERRADO 2026-11-03)
La decisión de "app nueva + core compartido" se mantiene, pero **sin librería publicable**: ambos proyectos Angular viven en el workspace de `frontend/` y comparten `src/app/core` por alias. Motivo: una librería `libs/core` con ng-packagr agrega segundo build, segundo install y un paso de publish local sin beneficio mientras web y móvil sean Angular del mismo repo.
- [x] Agregar el proyecto `mobile` al workspace (`frontend/projects/mobile`) manteniendo la app web en la raíz — `9a70ec9`.
- [x] Alias `@core/*` (relativo `./src/app/core/*`) en el `tsconfig` raíz — `9a70ec9`.
- [x] Instalar Ionic 9.0.10 + Capacitor 8.6.0 + ionicons — `37b2d89`.
- [x] Tema oscuro de Stitch en el proyecto mobile + `capacitor.config.ts` (`webDir dist/mobile/browser`) — `9a70ec9` + `216532a`.
- [x] **Criterio cumplido:** web 81 archivos / 880 tests / 0; `ng build` (web) y `ng build mobile` exit 0; tsc 0; lint solo los 8 pre-existentes.
- Alternativa descartada por costo: `libs/core` como librería publicable.
- Hallazgos de P0: `@ionic/angular/standalone` no existe en v9 (el export raíz es standalone); no se necesita `zone.js`; `ng test`/`ng lint` ahora recorren ambos proyectos (`ng test app` para web-only); `IonRouterOutlet`/`IonIcon` inyectan `NgZone` → validar animaciones/change detection en dispositivo.

### P1 — Scaffold móvil y shell (CERRADO 2026-11-03)
- [x] `mobile/` con Ionic 9 + Angular 21 standalone + Capacitor 8 (Android primero) — P0.
- [x] Tema oscuro con los tokens de Stitch (variables CSS de Ionic: `--ion-background-color`, `--ion-color-primary`, fuentes) — P0.
- [x] `API_ORIGIN` por variable de build + `capacitor.config.ts` (appId `com.coldday.app`); el móvil inyecta el mismo módulo generado que la web — `7c98fc7`.
- [x] Shell: tabs por modo + guards — `9f4d30b`.
  - cliente: Panel (`/cliente/panel`), Equipos (`/cliente/equipos`), Cuenta.
  - técnico: Radar (`/tecnico/radar`), Mis OTs (`/tecnico/ots`), Liquidaciones (`/tecnico/liquidaciones`), Cuenta.
  - proveedor: Insumos (`/proveedor/insumos`), Documentos (`/proveedor/documentos`), Cuenta.
  - Los leaves son placeholders hasta P2, salvo Cuenta. Además de `/cliente|tecnico|proveedor/cuenta`, existe `/cuenta` canónico (misma pantalla, fuera de las tabs) para respetar el inventario.
- [x] A3 con el **selector "Modo cliente / técnico / proveedor"** (B15) persistido en `coldday.modo`; admin/contable van a `/solo-web` — `17318d2`.
- [x] Login funcional (A1 mínimo) con `AuthService`, toast móvil y estado de carga — `53be419`.
- [x] Desacople de la capa compartida del UI web: puerto `AVISO_SESION` + `ApiHttpError` en su propio módulo — `8213d23`.
- [x] Error HTTP móvil: 401 avisa una vez y cierra sesión; 0/5xx/4xx con copy humano — `7c98fc7`.
- [ ] **Criterio pendiente:** app corriendo en emulador Android contra el backend real; requiere dispositivo/emulador y no es verificable en este runtime.
- Hallazgos de P1:
  - El bundle móvil no contiene PrimeNG (grep de `dist/mobile` sin coincidencias). La clave: `AuthService` solo conoce `AVISO_SESION` y `mensaje-error`/`mock-db` ya no importan el interceptor de la web.
  - Ionic 9 con `ion-tabs` sin `ion-tab` hijos crea su propio `ion-router-outlet`: el id de cada tab debe ser el segmento de ruta y Ionic navega a `<prefijo>/<id>`.
  - Zoneless: los avisos de cambio de estado de Ionic (transiciones, tab bar) siguen dependiendo de listeners fuera de Angular; hay que validarlos en dispositivo antes de dar por buena la UX.
  - `AuthService` sin avisador registrado no rompe: el token `AVISO_SESION` tiene default no-op.

### P2 — Pantallas de negocio (3 entregas encadenadas)
- [ ] **P2.1 Auth + cliente:** A1 ✅, A2 ✅ (P2.1a); A4 ✅, A5 ✅ (P2.1b).
- [x] **P2.2 Cliente profundo:** A6 (`fb18f74`), A7 (`d469129`), A8 (`58ab9b1`), A9 (esta entrega); fixes de fidelidad Dark Ops en `3f83991`. Detalle en la sección P2.2.
- [x] **P2.3 Técnico + proveedor:** B1, B2, B3 (`fcf753a`), B4, C1 y C2 (`6b5e930`). Detalle en la sección P2.3.
- [ ] Cada entrega: specs de componente/servicio, y prueba manual en dispositivo.

#### P2.1a — A1 Login + A2 Registro (CERRADO 2026-11-03)
- [x] A1 con el look de Stitch (marca centrada, etiquetas visibles, toggle de contraseña, error inline + toast, enlace al registro) sobre `AuthService`; la navegación sigue saliendo de `ModoService` — `41eff45`.
- [x] A2 `/registro` público con selector de rol y un set de campos por rol, contra los tres endpoints atómicos que ya usa la web — `80c1e32`.
- [x] `mensajeErrorAccion` + `copyConflictoAlta` espejado en `pages/registro/registro-copy.ts` (el de la web vive en un módulo que importa el toast de PrimeNG) — `80c1e32`.
- [x] `mobileErrorInterceptor` se calla en `POST /api/{clientes,tecnicos,proveedores}`: el formulario es la única voz del 400/409 — `80c1e32`.
- Verificación: `npm run mobile:test -- --watch=false` → 8 archivos / 65 tests / 0; `npx ng build mobile` → exit 0 y 0 coincidencias de `primeng|MessageService` en `dist/mobile`; `npx ng test app --watch=false` → 81 / 880 / 0; `tsc --noEmit` móvil y web → 0; `npm run lint` → solo los 8 errores web preexistentes.
- Diferencias con la web, forzadas por el backend (no por diseño):
  - Cliente: `ClienteOnboardingApiRequest` exige `calle` y `ciudad` (`@NotBlank`); el móvil las pide en vez del `'Por definir'`/`'Cúcuta'` fijos de la web. `barrio` y `ubicacion` son opcionales y se omiten hasta que A5 tenga mapa.
  - Técnico: `TecnicoApiRequest.categoriasServicio` es `@NotEmpty`, así que la especialidad NO puede ser opcional; se preseleccionan las dos de la web y se exige al menos una. `certificaciones: []` como la web: el DTO exige objetos `Certificacion` (nombre, institución, fechas), no texto libre.
  - Proveedor: `ProveedorApiRequest` no tiene dirección ni ciudad, así que no se piden. Al crear la cuenta aterriza en `/proveedor/documentos` (no en Insumos): nace `PENDIENTE` y sus solicitudes responderían 403, igual que en la web.
  - Habeas Data: el checkbox con la copy de la web (Ley 1581) sigue siendo obligatorio porque el backend lo declara `@NotNull`.
- Pendiente de esta entrega: prueba manual en emulador (misma limitación de runtime que P1).

#### P2.1b — A4 Panel Cliente + A5 Solicitar servicio (CERRADO 2026-11-03)
- [x] Filtros, contadores y copy por vista del panel movidos al core compartido; copy del 409 del perfil a `core/errorStatus/perfil-cliente` — `ad783aa`.
- [x] A5 `/cliente/solicitar`: categoría, descripción (mín. 10), dirección (mín. 5), geocodificación por el proxy del backend o GPS, coordenadas de solo lectura, borrador compartido y alta de perfil en un toque — `dceb033`.
- [x] A4 `/cliente/panel`: saludo, contadores, `ion-segment` de cuatro vistas, `ion-refresher`, estado vacío accionable, error de carga con «Reintentar», tarjeta de perfil faltante y sondeo de 25 s solo con la app visible — `30cb04b`.
- [x] Locale `es-CO` registrado en la app móvil (`provideColombianLocale`).
- Verificación: `npm run mobile:test -- --watch=false` → 10 archivos / 106 tests / 0; `npx ng build mobile` → exit 0 y 0 coincidencias de `primeng|MessageService` en `dist/mobile`; `npx ng test app --watch=false` → 81 / 880 / 0; `tsc --noEmit` móvil y web → 0; `npm run lint` → solo los 8 errores web preexistentes.
- Diferencias deliberadas con la web:
  - **Sin mapa interactivo** en esta entrega: la dirección se geocodifica por el proxy del backend o se toma del GPS, y el punto se muestra como texto de solo lectura. El pin arrastrable llega en P3 con mapas nativos.
  - **Sin foto de evidencia**: el backend es metadata-only, no hay endpoint de upload; no se inventa una cámara.
  - El fallo de carga inicial no se disfraza de lista vacía, y un refresco fallido conserva la lista que el cliente está leyendo.
  - «Historial» navega a `/cliente/equipos` (tab real), no al enlace muerto `/cliente/historial` de la web.
  - El alta de perfil vive en la propia solicitud: `/perfil/agregar` no existe en móvil, así que no se ofrece «completar por separado».
  - El éxito de A5 navega a `/cliente/panel` (A6 todavía no existe) con el toast del broadcast.
  - El interceptor móvil se calla en `POST /api/ot`, `POST /api/clientes/perfil`, `GET /api/clientes/me/ots`, `/api/maps/*` y el ping de ubicación: la pantalla es la única voz. Un 401 con sesión activa sigue avisando una vez y cerrando sesión.
  - El copy compartido del panel pasa a voseo, así que la web también lo muestra.
- Pendiente de esta entrega: prueba manual en emulador —permiso de geolocalización del WebView y ausencia de mapa— (misma limitación de runtime que P1).

#### P2.2 (en curso) — A6/A7/A8 entregados, A9 pendiente
- [x] A6 `/cliente/ot/:id` (SSE + mapa + poll gated) — `fb18f74`.
- [x] A7 `/cliente/ot/:id/diagnostico` (respuesta del cliente al presupuesto) — `d469129`.
- [x] A8 `/cliente/ot/:id/pago` — `58ab9b1`. Sin selector de medio de pago (ningún endpoint lo recibe); CTA "Registrar acta de garantía" deshabilitado sin trazo y mientras la OT no esté FINALIZADA (banner lo explica; el servidor sigue mandando: FINALIZADA o 409); montos read-only con formato es-CO y split de comisión 15/85 desde una constante compartida del core (`COMISION_PLATAFORMA_RATE`, espejo de `environment.commissionRate` y de `app.liquidacion.comision-porcentaje`) para no arrastrar la key de Google Maps al bundle nativo; canvas 480×140 con Pointer Events; éxito solo con `codigoVerificacion` del servidor; 409/400/403 con copy propia; la firma dibujada sobrevive a un fallo del registro.
- Verificación (A8): `npx ng build mobile` → exit 0 y 0 coincidencias de `primeng|MessageService` en `dist/mobile`; `npm run mobile:test -- --watch=false` → 13 archivos / 192 tests / 0; `npx ng test app --watch=false` → 83 / 890 / 0; `tsc --noEmit` móvil y web → 0; `npm run lint` → solo los 8 errores web preexistentes, móvil limpio.
- Diferencias deliberadas con la web (A8): sin selector de medio de pago; la visita no se consulta (fila "Por confirmar", misma convención que A7); el CTA se deshabilita antes de FINALIZADA en vez de enseñar con el 409; la cláusula legal se conserva verbatim de la web; la visita pagada/pendiente se muestra como nota (bloqueo real: servidor, 409).
- Hallazgo (A8): el web reseteaba `guardando` en `complete`, así que un error de red dejaba el botón deshabilitado para siempre; el móvil lo resetea en `finalize`. Candidato a backport en `pago-acta-page` web.
- Pendiente de esta entrega: prueba manual en emulador (misma limitación de runtime que P1); A9 (calificar) y el cierre de P2.2.

### P3 — Capacidades nativas (lo que la web no puede dar)
- [ ] **Token seguro:** `localStorage` → Capacitor Preferences (o Secure Storage).
- [ ] **Push real (FCM/APNs):** adapter del `NotificacionPushPort` (hoy `LoggingNotificacionPushAdapter`), endpoint de device tokens, permiso, tap → deep link a la oferta/OT.
- [ ] **Ubicación en background:** plugin nativo + foreground service (Android) / background modes (iOS). **Bloqueante de producto**: con la regla actual del radar (2 min de vigencia) un técnico con el teléfono bloqueado desaparece.
- [ ] **Mapas nativos:** Google Maps SDK Android/iOS (keys por package/bundle) o mapa web con key restringida a origins nativos. `@capacitor/google-maps` es la opción nativa.
- [ ] **Deep links:** App Links/Universal Links para mails (verificación, recuperación) con fallback web.
- [ ] **Cámara/archivos:** DECISIÓN PENDIENTE — el backend es metadata-only. Si la app toma fotos de evidencia hace falta storage + endpoint de upload. En P2 se mantiene el comportamiento actual (sin upload).
- [ ] **PWA/offline mínimo:** estado offline visible + reintento en acciones críticas (el técnico trabaja en campo).

### P4 — Builds y salida
- [ ] CI: `assembleRelease` (AAB) + IPA, versionado, firma, entornos (API_ORIGIN por env).
- [ ] Checklist de tiendas, iconos/splash desde el logo de Stitch.
- [ ] Plan de migración de usuarios: la web sigue disponible; la app se ofrece como canal.

#### P2.2 — A6–A9 (CERRADO 2026-11-04)
- [x] **A6 Seguimiento** `fb18f74`: SSE + poll de respaldo 25 s, posición del técnico cada 15 s con gate de visibilidad, ETA haversine 25 km/h, mapa WebView con degradación honesta (tarjeta + "Reintentar mapa"), acciones completas (cancelar, pagar visita, disputa, presupuesto, calificar).
- [x] **A7 Diagnóstico y presupuesto** `d469129`: dictamen con fallbacks honestos, tres filas de costo, total idéntico a la web, aprobar/rechazar solo en `EN_DIAGNOSTICO`, rechazo inline con motivo ≥5.
- [x] **A8 Pago y acta** `58ab9b1` + `7799734`: canvas normalizado con Pointer Events, CTA honesto ("Registrar acta de garantía"), gating explícito en `FINALIZADA`, 409/400 con copy propia, guard `finalize()` en lugar del bug de `complete()` de la web.
- [x] **A9 Calificar** `1b5fc42`: estrellas sin default, 6 aspectos, payload con `[Aspectos: …]` **siempre** (paridad exacta con la web), 409 con copy propia, bloqueo cuando no está FINALIZADA o ya fue calificada.
- [x] **Fidelidad Dark Ops** `3f83991`: overrides bajo `:root.md` (canvas `#0b1220`, surfaces `#111b2e`), Space Mono/Public Sans cargadas, CTA 48 px Grotesk + glow, iconos registrados, tab bar 64 px.
- Verificación al cierre: móvil **14 archivos / 201 tests / 0**; web **83 archivos / 890 tests / 0**; `ng build mobile` exit 0; 0 coincidencias de PrimeNG; `tsc` 0/0; lint solo los 8 errores preexistentes.
- Pendiente: reconstrucción estructural de fidelidad (chrome/componentes de A1/A2/A3/A4/A5) según `odd/tasks/ionic-stitch-fidelity.md`, y prueba en dispositivo (mapa WebView, dialer, SSE/poll con la app en background).

#### P2.3 — Técnico + proveedor (CERRADO 2026-11-04)
- [x] **B1 Radar de ofertas** `fcf753a`: lista de ofertas con distancia/vigencia, auxiliares 0..10, 409 de concurrencia con copy propia, SSE + poll 25 s, bloqueo por validación/liquidación.
- [x] **B2 Panel técnico** `fcf753a`: disponibilidad (segment, 409 con copy), switch de ubicación ligado a la política de presencia (bloqueado durante OT), OTs activas con error/retry y navegación a ejecución.
- [x] **B3 Ejecución** `fcf753a`: iniciar desplazamiento (gate por visita paga), llegada, diagnóstico + presupuesto + insumos, finalizar con medio de pago, historial de insumos de la OT.
- [x] **B4 Perfil técnico** `6b5e930`: datos, validación con motivo de rechazo, especialidades editables (≥1, orden canónico) y documentos en lectura. La carga de documentos queda en la web (no hay upload en el backend).
- [x] **C1 Solicitudes de proveedor** `6b5e930`: aceptar/rechazar/entregar, 403 = gate documental, 409 = otra empresa tomó la solicitud, estados de oferta y requerimiento.
- [x] **C2 Documentos de proveedor** `6b5e930`: estado de validación de la sesión y declaración de metadata (tipo + vencimiento). Sin subida de archivos: se dice explícitamente.
- Verificación al cierre: móvil **20 archivos / 241 tests / 0**; web **83 / 890 / 0**; `ng build mobile` exit 0; 0 PrimeNG; `tsc` 0/0; lint móvil limpio (web solo los 8 preexistentes).
- Nota: `getMisOts`/`getOfertasParaTecnico` resuelven el técnico desde el principal; el `tecnicoId` solo se usa en modo mock.
- Pendiente: el radar móvil no dibuja el mapa del radar (llega con la pasada de fidelidad/P3); la ejecución no permite pedir insumos por separado del diagnóstico (van juntos en el mismo formulario).

## Fotos de evidencia (decisión de backend, no de migración)
El backend es metadata-only. Implementación recomendada cuando se decida:
1. `POST /api/ot/{id}/evidencias/presign` → autoriza por participación, valida mime/tamaño y devuelve URL firmada de PUT (TTL 60–120 s) para `ots/{otId}/{uuid}.ext`.
2. La app comprime (cámara Capacitor, lado máx. 1600–2048 px) y sube **directo al bucket** (S3 / R2 / Supabase Storage).
3. `POST /api/ot/{id}/evidencias` confirma metadata (`storage_key`, mime, bytes, dimensiones, sha256, subida_por) — tabla `ot_evidencia`; emite evento.
4. Lecturas con URLs firmadas de GET (TTL 5–15 min). Bucket nunca público.
Guardas: límite de fotos y tamaño por OT, rate limit, `sha256` para idempotencia, re-encode/EXIF, retención y cola offline en la app. Alternativa más rápida: Cloudinary/Firebase Storage (SDK + CDN, vendor lock-in).

## Riesgos y bloqueantes
1. **Ubicación en background (alto):** sin P3, el radar expulsa técnicos que manejan con el teléfono bloqueado. Debe entrar en la primera release con técnicos.
2. **Push (alto):** SSE no sobrevive en background; sin FCM el técnico no ve ofertas con la app cerrada.
3. **Keys de Maps por plataforma:** Android package + SHA-1 (debug y release), iOS bundle id. Directions ya está habilitada en la key de servidor.
4. **Sin uploads:** si el diseño incluye fotos, es feature nueva de backend, no migración.
5. **Divergencia de tema:** el cyan móvil (`#22d3ee`) ≠ sky web (`#0284c7`); aislar en el tema móvil para no contaminar la web.
6. **Costo Directions:** se mantiene el guard del cliente; en móvil el background puede multiplicar clientes mirando → revisar la política antes de release.

## Fuera de alcance
- Admin en móvil (sigue en la web Angular).
- Wrapper Capacitor de la UI web.
- Reescribir backend.

## Verificación
- Cada fase con su suite (web: **83 archivos / 890 tests**; móvil: **20 / 241**) + build Android.
- Prueba manual en emulador/dispositivo por fase.
- Verificador independiente por entrega (review nativa no transitable en este runtime).
