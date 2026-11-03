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
- [ ] **P2.1 Auth + cliente:** A1 ✅, A2 ✅ (P2.1a); A4, A5 pendientes (con draft + un-tap perfil).
- [ ] **P2.2 Cliente profundo:** A6 (SSE + mapa + poll gated), A7, A8, A9.
- [ ] **P2.3 Técnico + proveedor:** B1, B2, B3, B4, C1, C2.
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
- Cada fase con su suite (web: 81/880; móvil: specs nuevas) + build Android.
- Prueba manual en emulador/dispositivo por fase.
- Verificador independiente por entrega (review nativa no transitable en este runtime).
