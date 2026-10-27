# Feature: dual-role-cliente-ot — perfil cliente sin fricción y acceso del dueño

## Objetivo
Un usuario TÉCNICO (o PROVEEDOR) que pide un servicio como cliente debe poder: crear su perfil de cliente sin re-tipear datos, quedarse logueado, y ver/seguir la OT que pidió. Hoy hay tres bugs encadenados y un formulario que pide de nuevo lo que ya tenía.

## Causas raíz verificadas (2026-10-27)
1. **La OT nunca se crea**: `CrearOtUseCase.java:89-92` lanza `ClienteNoEncontradoException` antes de persistir (transacción `REQUIRES_NEW`). El estado del formulario vive solo en signals del componente (`solicitar-servicio-page.ts:46-70`) y muere al navegar. No hay draft ni returnUrl.
2. **El dueño dual-role recibe 403**: `AutorizacionPropietario.java:93-98` deniega al usuario con rol TECNICO que ES el cliente dueño de la OT. El listado `/clientes/me/ots` sí la muestra → tarjeta visible, detalle 403.
3. **Sesión inservible hasta re-login**: `RegistrarClienteUseCase.java:84-87` bumpea `tokenVersion`; el JWT viejo muere (`JwtAuthenticationFilter.java:56-58`) y el interceptor hace logout forzado. No existe refresh token ni método de refresco.
4. **Relleno**: `agregar-perfil-page.ts:71-79` pide `tipoCliente/calle/ciudad/barrio` sin pre-llenado; `calle`/`ciudad` son los datos recién tipeados en la OT. El backend deriva `nombre/correo/telefono` (`ClienteMapper.java:27-40`) y acepta `ubicacion`, que la página nunca envía.
5. **Guard/menú desalineados**: `app.menu.ts:22` ofrece "Mis Órdenes" a TECNICO; `app.routes.ts:47` solo admite CLIENTE/ADMINISTRADOR.

## Checklist

### Slice backend
- [x] **D1** — `AutorizacionPropietario`: el dueño del perfil cliente accede a su OT siempre, sin importar otros roles. Tests: dual-role dueño → permitido; TECNICO no-dueño → 403; CLIENTE dueño → permitido; ADMIN → permitido. — commit `5dffc1d`.
- [x] **D2** — `POST /api/clientes/perfil` devuelve un JWT nuevo (campo aditivo `token`) con roles y `ver` actualizados, emitido por el mismo issuer del login. Tests: el token nuevo autoriza, incluye CLIENTE en `roles`, y el token previo sigue rechazado. — commit `70da717`.
- [x] **D2b** — Si `POST` de perfil técnico tiene la misma revocación, aplicar el mismo patrón (simetría mínima). — commit `5af2c89`.

### Slice frontend
- [x] **D3** — `AuthService`: adoptar un token refrescado sin logout (reusar `establecerSesionDesdeToken`). — commit `b8fff2f`.
- [x] **D4** — `agregar-perfil-page`: al éxito adopta la sesión nueva, vuelve al `returnUrl` (o al panel correspondiente) y NO hace logout. Fallback: si no viene token, comportamiento actual. — commit `4a48a22`.
- [x] **D5** — Draft de la solicitud en `sessionStorage` (precedente `proveedor-registro.service.ts`), restaurado al volver y limpiado al crear la OT. — commit `048f3c0`.
- [x] **D6** — Tarjeta de un-tap en `solicitar-servicio-page`: al detectar perfil faltante muestra la dirección ya tipeada (editable) + `tipoCliente` B2C + ciudad de operación como default editable; un botón "Crear perfil de cliente y enviar solicitud" crea el perfil y reintenta `crearOt` automáticamente. Sin relleno manual, sin auto-creación silenciosa (el tap es el consentimiento). — commit `75360a2`.
- [x] **D7** — `cliente/panel` admite TECNICO (coherente con el menú); si el usuario no tiene perfil cliente, estado honesto con CTA (no error crudo). Mismo tratamiento en `historial-equipos` si aplica. — commit `a771af0`.
- [x] **D8** — Specs: draft (persistencia/restore/limpieza), un-tap (crear+reintentar+éxito), sesión sin logout, panel sin perfil. — verificación en este commit (`docs(odd): record dual-role cliente closure evidence`).

## Evidencia de cierre (2026-10-27)
- Backend: **132 suites / 914 tests / 0** (`BUILD SUCCESSFUL`); targeted `PerfilAcquisitionIT` 8/0, `OtApiIT` 16/0, `AutorizacionPropietarioTest` 5/0.
- Frontend: `npm test -- --watch=false` → **77 archivos / 777 tests / 0 fallos** (baseline 76/749/0).
- `npx tsc --noEmit -p tsconfig.app.json` → 0 errores.
- `npx tsc --noEmit -p tsconfig.spec.json` → 0 errores.
- `npm run lint` → solo los 8 errores pre-existentes (2 `no-explicit-any` en `maps-geocoder-cliente.spec.ts`, 6 `label-has-associated-control` en `agregar-perfil-page.html`).
- Revisión de la API del backend verificada contra `ClienteApiResponse.conToken` / `TecnicoApiResponse` de `70da717` y `5af2c89`: la clave `token` es aditiva y se omite cuando es nula.

## Correcciones post-verificación (2026-10-27)
- **D7 estaba inalcanzable (MAJOR del verificador)**: `/clientes/me/ots` exigía `hasRole('CLIENTE')`, así que un técnico sin perfil recibía **403**, nunca el 404 que clasifica el estado de negocio; el spec lo ocultaba mockeando un 404 inexistente. Corregido en `1006f72`: el endpoint acepta cualquier autenticado, `ListarOtUseCase` devuelve 404 real cuando no hay perfil, y 403 queda reservado a participación en OTs. Tests HTTP nuevos: técnico sin perfil → 404 con mensaje; técnico con perfil → 200 solo sus OTs; anónimo → 401; aislamiento entre clientes; técnico no-dueño y otro cliente → 403 en detalle/historial.
- **Fricción residual** (`801e59a`): 409 tras perfil ya creado ahora da copy accionable ("iniciá sesión; tu solicitud quedó guardada") en vez de loop; `returnUrl` valida solo rutas internas (rechaza absolutas y `//host`); la dirección editada en la tarjeta también se usa para la OT reintentada; specs de no-creación-en-carga y anti doble-submit; mock con token decodable.

## Fuera de alcance
- Auto-provisión del perfil cliente en `POST /api/ot` (Opción 2, decisión de negocio aparte).
- Refresh token / sesión deslizante (esto es re-emisión puntual al crear perfil).
- Migración física a Ionic.

## Criterios de aceptación
1. Técnico pide servicio → ve la tarjeta de un-tap → confirma → la OT queda creada y visible en su panel.
2. Puede abrir el detalle y seguimiento de su propia OT (sin 403).
3. No hay logout ni re-login en el flujo; no re-tipea dirección ni ciudad.
4. Al volver al formulario, si abandonó sin crear, los datos siguen ahí.
5. Los 4 casos de autorización tienen test y el flujo dual-role tiene specs de comportamiento.

## Verificación
- Backend: suites targeted + suite completa (baseline 131 suites / 900 tests / 0).
- Frontend: `npm test -- --watch=false` (baseline 76 / 749 / 0), tsc app+spec, lint solo los 8 pre-existentes.
- Verificador independiente sobre el diff (review nativa no transitable en este runtime).

## Entrega
- Rama `feat/dual-role-cliente-ot` stacked sobre `feat/prep-ionic-frontend-b` (`ed07074`).
- 2 PRs encadenados: backend (D1/D2) y frontend (D3–D7), o uno solo si el total queda bajo el budget de 400 líneas.
