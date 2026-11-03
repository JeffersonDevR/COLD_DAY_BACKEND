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
| Logo | — | asset |
| Heatmap de A9 | — | descartar (artefacto de Stitch) |

**Pantallas que faltan en Stitch** (generar después vía MCP): panel/home del técnico con estado de ubicación, historial "Mis equipos", agregar segundo perfil, estados vacíos/error de cada flujo, y las variantes de confirmación.

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

### P0 — Extracción del core (sin tocar pantallas)
- [ ] Crear `libs/core` como librería Angular (ng-packagr) con alias `@coldday/core`.
- [ ] Mover sin reescribir: clientes/tecnicos/proveedores/ot/maps APIs, `api.config` + `API_ORIGIN`, `auth.service`, `token-storage`, `sse.service`, `mensaje-error`, `visible-tab-polling`, `solicitud-draft`, `tecnico-tracking` + `tecnico-presencia`, mappers y DTOs, guards y `panel-resolver`, `locale`.
- [ ] La web importa desde `@coldday/core`; `frontend/src/app/core` queda como re-export temporal para no romper imports internos.
- [ ] **Criterio:** web sigue con 81 archivos / 880 tests / 0, tsc 0, lint 8. Sin cambios de comportamiento.

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
