# La web queda solo como panel admin

Fecha: 2026-11-26. Estado: **aprobado** (2026-11-26).

## Intención

El producto es 100 % móvil (Ionic). La web deja de atender a clientes, técnicos y proveedores y queda como consola interna. Hoy el sistema está en pruebas con un grupo selecto que ya usa solo la app móvil, así que no hay usuarios web que migrar.

## Objetivos

- La web solo tiene: login, recuperar contraseña y pantallas internas.
- La app móvil no cambia de comportamiento.
- No queda código muerto de las pantallas retiradas.

## Fuera de alcance

- Roles nuevos o permisos (siguiente proyecto, abajo).
- iOS (proyecto posterior).
- Cambios en `backend/` o en `frontend/projects/mobile`.
- Mover `core/` a otro proyecto, sacar `mock-db.service.ts`, refresh token, paginación.
- Pantalla móvil de recuperar contraseña.

## Enfoques considerados

| Enfoque | A favor | En contra |
| --- | --- | --- |
| **A. Podar en su sitio (elegido por el dueño)** | Cambio pequeño; CI, Vercel y alias `@core` siguen igual | `core/` sigue dentro del proyecto web |
| B. `projects/admin` + `projects/shared` | Estructura más limpia | Mueve rutas, CI y despliegue a la vez |
| C. Admin dentro de Ionic | Una sola app | Tablas densas en móvil; código admin dentro del APK |

## Diseño

### Rutas que quedan

`/login`, `/recuperar`, `/panel`, `/admin/dashboard`, `/admin/validacion-tecnicos`, `/admin/consignaciones`, `/admin/disputas`, `/admin/monitoreo`, `/admin/proveedores`, y las dos nuevas de abajo.

`/recuperar` se queda **pública para todos los roles**: el correo de recuperación apunta ahí (`app.mail.reset-url-base`) y la app móvil no tiene esa pantalla.

### Pantallas que se retiran (17)

`registro`, `agregar-perfil`; cliente: `panel-cliente`, `solicitar-servicio`, `seguimiento-ot`, `diagnostico-ot`, `pago-acta`, `calificar-servicio`, `historial-equipos`; técnico: `panel-tecnico`, `mi-perfil-tecnico`, `ofertas`, `ejecucion-ot`, `perfil-documentos`, `liquidaciones-tecnico`; proveedor: `solicitudes-proveedor`, `documentos-proveedor`.

Los endpoints públicos de registro del backend **no se tocan**: los usa la app.

### Dos pantallas nuevas (propuestas, no pedidas)

1. **`/usa-la-app`**: a donde llega quien inicie sesión con rol `CLIENTE`, `TECNICO` o `PROVEEDOR`. Explica que debe usar la app y permite cerrar sesión. Sin esto quedaría en un bucle o en una pantalla vacía.
2. **`/admin/ot/:id`**: detalle de solo lectura. Hoy `monitoreo` enlaza a `/cliente/ot/:id`, que se retira. Muestra estado, cliente, técnico, descripción, montos que ya vengan en la respuesta y el historial (reutiliza `ot-timeline`). Sin mapa y sin acciones. No requiere cambios de backend; si un dato no llega para estos roles, no se muestra. Visible para `ADMINISTRADOR` y `CONTABLE` según lo que la API permita.

### Ajustes del armazón

- `app.menu.ts`: solo entradas internas.
- `panel-resolver.ts` y `auth.service.ts`: destinos por rol (internos a su panel; el resto a `/usa-la-app`). Una preferencia de panel guardada que apunte a una ruta retirada se ignora.
- `login-page`: quitar el enlace a registro.
- Topbar, sidebar y footer: quitar enlaces a rutas retiradas.

### Código que se elimina

- Las 17 carpetas de `pages/` con sus specs.
- De `shared/` y `core/`, solo lo que quede sin importadores en web **y** en móvil (incluye los 3 mapas web).
- `core/service/solicitudes-perfil-api.ts` **se conserva**: hoy no lo usa nadie, pero el backend existe y hará falta una pantalla.
- Dependencias: quitar `@angular/google-maps` solo si no queda ningún import (hoy `google-maps-loader.ts` lo menciona; verificar). Ninguna otra.

### Documentación

Actualizar `PRODUCT.md`, `DESIGN.md`, `docs/design/NAVEGACION.md`, `ARQUITECTURA.md` y `docs/mobile-paridad.md` donde afirmen que la web atiende a cliente, técnico o proveedor.

## Restricciones

- `AGENTS.md`: un commit por tarea, sin subir techos de reglas. Los techos de `ui:check` pueden bajar; solo entonces se regeneran con `npm run ui:update`.
- No tocar `frontend/.env` (`MOBILE_API_ORIGIN`).
- Los specs solo cambian donde cambia el comportamiento (menú, redirecciones, guards) o desaparece el código.

## Definición de hecho

- `npm run ui:check`, `npx ng build`, `npx ng test --watch=false` (web y móvil) y `npm run mobile:build` en verde.
- Ningún enlace interno apunta a una ruta retirada.
- Revisión en navegador contra backend local: login con admin, contable y un cliente; recuperar contraseña; abrir una OT desde monitoreo.
- `git diff` sin cambios en `backend/` ni en `frontend/projects/mobile`.

Nota: `CONTABLE` seguirá recibiendo 403 en `/api/admin/**` hasta el proyecto de roles.

## Queda a criterio de quien implementa

Orden de los commits, copy de `/usa-la-app` (tuteo, `DESIGN.md`) y maquetación del detalle de OT con los componentes existentes.

## Proyectos siguientes

### 2. Roles internos (matriz aprobada; se diseña aparte)

Pedido por el dueño: `CONTABLE` audita lo contable y un rol de Recursos Humanos audita documentación.

| Función | ADMINISTRADOR | CONTABLE | RRHH (nuevo) |
| --- | --- | --- | --- |
| Métricas y monitoreo de OT | Ver | Ver | No |
| Consignaciones | Aprobar y rechazar | Aprobar y rechazar | No |
| Validación de técnicos y proveedores | Aprobar y rechazar | No | Aprobar y rechazar |
| Disputas | Resolver | No | No |

Hechos que condicionan: `RRHH` no existe; la restricción `usuario_rol_check` obliga a una migración `V23`; `AdminController` solo admite `ADMINISTRADOR`; hoy no hay forma de crear cuentas internas salvo el seeder de desarrollo.

### 3. Preparar iOS

Solo documentado en [`docs/ios-preparacion.md`](../../ios-preparacion.md). Por decisión del dueño no se ejecuta nada de ese plan.
