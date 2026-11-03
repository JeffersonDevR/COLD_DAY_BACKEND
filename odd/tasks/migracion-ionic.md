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

## Arquitectura objetivo
```
repo/
├── backend/                # sin cambios
├── frontend/               # web Angular actual (se mantiene)
├── libs/core/              # NUEVO: librería Angular sin UI
│   ├── services/           # api clients, auth, sse, tracking, drafts, presencia
│   ├── models/             # DTOs + modelos de dominio
│   ├── guards/             # authGuard, roleGuard, panel resolver
│   └── i18n/               # locale es-CO
└── mobile/                 # NUEVO: app Ionic + Capacitor
    ├── src/app/            # shell, tabs, pantallas del inventario
    ├── capacitor.config.ts
    └── android/ ios/       # plataformas generadas
```
Regla: `libs/core` no importa nada de `@angular/material`, PrimeNG ni Tailwind; la UI vive en cada app. Alias `@coldday/core` en ambos `tsconfig`.

## Fases

### P0 — Workspace único con core compartido (revisado 2026-11-03)
La decisión de "app nueva + core compartido" se mantiene, pero **sin librería publicable**: ambos proyectos Angular viven en el workspace de `frontend/` y comparten `src/app/core` por alias. Motivo: una librería `libs/core` con ng-packagr agrega segundo build, segundo install y un paso de publish local sin beneficio mientras web y móvil sean Angular del mismo repo.
- [ ] Agregar el proyecto `mobile` al workspace (`frontend/projects/mobile`) manteniendo la app web en la raíz.
- [ ] Alias `@core/*` → `src/app/core/*` en `tsconfig` (web y mobile), sin mover archivos.
- [ ] Instalar Ionic + Capacitor en el `package.json` del workspace.
- [ ] Instalar `@ionic/angular` + tema oscuro de Stitch en el proyecto mobile.
- [ ] **Criterio:** la web sigue con 81 archivos / 880 tests / 0; `ng build mobile` compila el shell vacío; `ng build` (web) sigue OK.
- Alternativa descartada por costo: `libs/core` como librería publicable.

### P1 — Scaffold móvil y shell
- [ ] `mobile/` con Ionic 8 + Angular 21 standalone + Capacitor 7 (Android primero).
- [ ] Tema oscuro con los tokens de Stitch (variables CSS de Ionic: `--ion-background-color`, `--ion-color-primary`, fuentes).
- [ ] `API_ORIGIN` por variable de build + `capacitor.config.ts` (appId `com.coldday.app`).
- [ ] Shell: tabs por modo (cliente: Panel/Servicio/Cuenta · técnico: Radar/Mis OTs/Perfil · proveedor: Insumos/Documentos/Cuenta) + guard de modo.
- [ ] A3 con el **selector "Modo cliente / Modo técnico"** (B15) persistido.
- [ ] **Criterio:** app corre en emulador Android contra el backend real; login + tabs navegan; sin pantallas de negocio todavía.

### P2 — Pantallas de negocio (3 entregas encadenadas)
- [ ] **P2.1 Auth + cliente:** A1, A2, A4, A5 (con draft + un-tap perfil). 
- [ ] **P2.2 Cliente profundo:** A6 (SSE + mapa + poll gated), A7, A8, A9.
- [ ] **P2.3 Técnico + proveedor:** B1, B2, B3, B4, C1, C2.
- [ ] Cada entrega: specs de componente/servicio, y prueba manual en dispositivo.

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
