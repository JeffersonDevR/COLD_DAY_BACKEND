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
- [x] **T4 (B2)** — `API_ORIGIN` inyectable en `api.config.ts` (default `''` = relativo), usado por servicios + SseService; build moderno por variable. — CERRADO en `3b8ad40` (`API_ORIGIN` como token + `generate-api-origin.mjs` ya en la capa de transporte; el commit blinda la composición origen + `/api` + path con y sin slash, incluidas las URL absolutas que exige `EventSource` para SSE).
- [x] **T5 (B5)** — fix "técnico no puede pedir orden": al fallar `crearOt` con "No existe un perfil de cliente", guiar a `agregar-perfil-page` (flujo ya existente). Verificar ruta de registro dual-role mientras. Spec del flujo. — CERRADO en `585e4ba` (banner de guía a crear perfil de cliente cuando `crearOt` rebota por perfil faltante; spec del flujo dual-role).
- [x] **T6 (B6)** — adoptar `mensajeErrorAccion` en los 12+ sitios crudos listados en pendientes §5.2 (incluye interceptor fallback desactivable). — CERRADO en `9845404` (sitios con `err.message` crudo pasan por `mensajeErrorAccion`; el fallback del interceptor dejó de exponer el mensaje HTTP crudo/URL).
- [x] **T7 (B7)** — `ot-carga.ts` con estado de error visible + reintentar (5 páginas de OT afectadas). Spec del fallo. — CERRADO en `326bcd7` (`CargaOtEstado` con signal `error` + `reintentar()` reusando el último id; banner `role="alert"` con botón Reintentar en calificar, diagnóstico, ejecución, pago/acta y seguimiento; specs del helper y del banner).
- [x] **T8 (B10)** — polls con visibilidad gate: ubicación 15 s y poll de OT deja de enmascarar 404 vs 401/5xx (`ot-api.ts:139`). — CERRADO en `a25bac0` (`getTecnicoUbicacion` devuelve `null` solo en 404 y propaga 401/403/5xx/red; `pollVisibleTab(15000)` en seguimiento y `visibleTabChanges()` para el `watchPosition` del tracking; specs de ambos gates).

### Slice frontend B — honestidad + admin web (`feat/prep-ionic-frontend-b`)
- [x] **T9 (B11)** — 401 single-toast: el interceptor es dueño del aviso y las páginas no lo repiten. — CERRADO en `c016eb7` (el interceptor marca `sesionNotificada` en el 401 que ya avisó y `avisarErrorAccion` omite el segundo toast en los sitios de acción; el barrido inicial dejó ofertas/radar afuera y se completó en `67b6560`; specs del interceptor, del helper, de calificar-servicio y de ofertas).
- [x] **T10 (B13)** — quitar chat fake de diagnóstico (banner "próximamente" no funcional interactivo). — CERRADO en `25c0bf5` (banner no interactivo; se fueron `chatMensajes`, `enviarMensaje`, el input y la auto-respuesta simulada).
- [x] **T11 (B14)** — quitar defaults falsos: diagnóstico pre-llenado, referencia bancaria de ejemplo inventada, 5 estrellas default en calificar. — CERRADO en `33d67fa` (formulario del técnico vacío y no enviable vacío; comprobante sin referencia ni URL inventadas; calificar sin estrellas/aspectos/comentario preseleccionados; la vista del cliente muestra el dictamen real y no inventa montos). El tiempo estimado inventado y los fallbacks de dinero (pago/acta) se corrigieron en `2c49c09`.
- [x] **T12 (B8, web)** — cargas admin silenciosas con estado de error (dashboard, monitoreo, consignaciones, validación, disputas, proveedores). — CERRADO en `3e5935e` (`app-carga-error` compartido con `cargando`/`errorCarga` en las seis pantallas; el poll de monitoreo no reemplaza la tabla por el aviso). Los estados "vacío porque falló" de proveedores y "0 porque falló" del contador de técnicos bloqueados de consignaciones se corrigieron en `a352523`; las tarjetas de resumen de consignaciones ("0 comprobantes", "$ 0 COP", "0 registros totales") recién quedaron honestas en `e7dbe21`, que también sacó el "$ 0" del presupuesto inexistente en seguimiento/monitoreo.
- [x] **T13 (B12)** — "Mis equipos" funcional: derivar tarjetas reales de `ClientesApi.getOtsPorCliente`. — CERRADO en `ffe2835` (tarjetas por categoría con última OT, falla, estado, fecha y link al seguimiento; estado vacío y error con reintentar; spec con lista mockeada). El copy que prometía garantías y servicios cerrados se alineó en `67b6560`.

## Correcciones post-verificación (2026-10-27)
Una revisión independiente encontró defectos de honestidad que sobrevivieron al cierre. Correcciones sobre `753e17e`:
- `2c49c09` — fuera el tiempo estimado que la API nunca envía (y su campo requerido sin efecto en el submit) y los fallbacks `80.000`/`70.000` de pago/acta; placeholder de comprobante neutro.
- `a352523` — proveedores ya no muestra el estado vacío sobre un fallo de carga; consignaciones reporta el conteo de bloqueados como "no disponible" si falla el listado de técnicos.
- `67b6560` — errores de ofertas por status (409 = concurrencia; 401/403/5xx/red = copy genérica, sin segundo toast en 401) y copy real de historial de equipos (sin garantías, OTs registradas).

## Fuera de alcance
- B9 (LOCALE_ID es-CO) — decisión del usuario pendiente.
- Canales SSE nuevos (admin/insumos/cliente) y revamp visual — chez Stitch después.
- Integer feature-state migration Ionic física (workspaces) — addressed in the migration feature docática cuando la UI llegue.

## Entrega
- Forecast: ~350 backend (mayoría tests) + ~600-700 frontend en 2-3 PRs encadenados. Strategy: `ask-on-risk` ya registrada en el roadmap (chains confirmed by user in 2.4: stacked-to-main si hay que repetir). Re-evaluar al sumar commits.
- Base: `origin/main` post-cierre-a07d2a4 (e1c8dcc).
