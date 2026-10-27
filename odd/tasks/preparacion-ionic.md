# Feature: preparacion-ionic — blockers + quickwins pre-Ionic (roadmap §5.1/§5.2)

## Objetivo
Dejar el código listo para la implementaciónIonic mientras se diseña la UI en Stitch. No cambia pantallas: solo arquitectura de transporte, bugs de UX y datos falsos.

## Decisión de contexto (audit + Stitch pack 2026-10-26)
- Ionic móvil = cliente + técnico + **proveedor**; admin queda en Angular web.
- Estética Ionic native, paleta actual (sky `#0284c7`, amber, violeta, slate). Logo/refresh visual después.
- Review nativa no transitable en este runtime (aún); verificador independiente como fallback.

## Checklist

### Slice backend (`feat/prep-ionic-backend`)
- [x] **T1 (B1)** — CORS: aceptar schemes `capacitor://` / `file://` (config + SecurityConfig) sin abrir `*`. Tests: IT permit/deny. — CERRADO en `20e46f2` (allowlist explícita `capacitor://localhost`, `https://localhost`, `ionic://localhost`, sin comodines; `CorsNativeOriginsIT` 5 tests + rejection).
- [x] **T2 (B3)** — `GET /api/usuarios/me` (autenticado: usuarioId, nombre, correo, rol, roles, perfiles) + `nombre` en el JWT claim (`JwtTokenIssuer`), sin romper tokens viejos (claim opcional). Tests backend + branch mock en `UsuariosApi`. — CERRADO en `3faa8f3` (`nombre` opcional, legacy = nombre vacío en el principal; `/me` lee SIEMPRE del agregado; ids de perfil scalars via `PerfilesDeUsuarioPort`).
- [ ] **T3 (B4, parcial)** — documentar (no code) la verificación de la key de Maps para origin nativo; lo ejecuta el usuario en Google Console.

### Slice frontend A — transporte + bugs (`feat/prep-ionic-frontend-a`)
- [ ] **T4 (B2)** — `API_ORIGIN` inyectable en `api.config.ts` (default `''` = relativo), usado por servicios + SseService; build moderno por variable.
- [ ] **T5 (B5)** — fix "técnico no puede pedir orden": al fallar `crearOt` con "No existe un perfil de cliente", guiar a `agregar-perfil-page` (flujo ya existente). Verificar ruta de registro dual-role mientras. Spec del flujo.
- [ ] **T6 (B6)** — adoptar `mensajeErrorAccion` en los 12+ sitios crudos listados en pendientes §5.2 (incluye interceptor fallback desactivable).
- [ ] **T7 (B7)** — `ot-carga.ts` con estado de error visible + reintentar (5 páginas de OT afectadas). Spec del fallo.
- [ ] **T8 (B10)** — polls con visibilidad gate: ubicación 15 s y poll de OT deja de enmascarar 404 vs 401/5xx (`ot-api.ts:139`).

### Slice frontend B — honestidad + admin web (`feat/prep-ionic-frontend-b`)
- [ ] **T9 (B11)** — 401-msg single-toast: record pří interceptorto + pages ya notifican al mismo fallo.
- [ ] **T10 (B13)** — quitar chat fake de diagnóstico (banner "próximamente" no funcional interactivo).
- [ ] **T11 (B14)** — quitar defaults falsos: diagnóstico pre-llenado, comprobante `BCOL-8492048`, 5 estrellas default en calificar.
- [ ] **T12 (B8, web)** — cargas admin silenciosas con estado de error (dashboard, monitoreo, consignaciones, validación, disputas, proveedores).
- [ ] **T13 (B12)** — "Mis equipos" funcional: derivar tarjetas reales de `ClientesApi.getOtsPorCliente` (categoría + descripción de falla + última OT + estado + fecha + link al seguimiento). Sin backend nuevo. Spec.

## Fuera de alcance
- B9 (LOCALE_ID es-CO) — decisión del usuario pendiente.
- Canales SSE nuevos (admin/insumos/cliente) y revamp visual — chez Stitch después.
- Integer feature-state migration Ionic física (workspaces) — addressed in the migration feature docática cuando la UI llegue.

## Entrega
- Forecast: ~350 backend (mayoría tests) + ~600-700 frontend en 2-3 PRs encadenados. Strategy: `ask-on-risk` ya registrada en el roadmap (chains confirmed by user in 2.4: stacked-to-main si hay que repetir). Re-evaluar al sumar commits.
- Base: `origin/main` post-cierre-a07d2a4 (e1c8dcc).
