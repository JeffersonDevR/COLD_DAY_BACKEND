# Roles internos: Contable, Recursos Humanos y cuentas desde el panel

Estado: **implementado** en `feat/roles-internos`; el backend está pendiente de verificarse en CI.

## Para qué

Contable debe poder auditar lo contable y Recursos Humanos la documentación, cada uno con su cuenta, sin usar la del administrador.

## Cómo está hoy

- El rol `CONTABLE` existe y la web le muestra Torre de control, Conciliación y Monitoreo, pero el backend le responde 403 en las tres.
- No existe rol de Recursos Humanos ni forma de crear cuentas internas (solo el sembrador de desarrollo).
- La pantalla de validación de técnicos muestra el expediente vacío contra el backend real: la API de administración no entrega documentos (`backend.mappers.ts` devuelve `documentos: []`).
- La pantalla de proveedores no muestra documentos, aunque `GET /api/proveedores/{id}/documentos` existe.
- Los documentos son datos declarados (tipo y fechas); no hay archivos.

## Objetivos

1. Contable y Recursos Humanos entran al panel y hacen solo lo suyo, con el backend como autoridad.
2. El administrador crea, desactiva y reactiva esas cuentas desde el panel.
3. Cada cuenta nueva pone su propia contraseña con una invitación por correo.
4. Quien valida técnicos o proveedores ve los documentos declarados.

## Fuera de alcance

- Subir archivos (proyecto siguiente, con bucket de Railway).
- Registrar quién aprobó o rechazó cada cosa (hoy no se guarda en ningún lado).
- Crear o administrar cuentas de administrador desde el panel.
- Editar nombre o correo de una cuenta, o cambiarle el rol.
- Cambios en la app móvil, salvo lo necesario para que compile con el rol nuevo.
- iOS.

## Pendiente de decidir (con el jefe)

Una cuenta interna puede **solicitar** un perfil de técnico o cliente y, si un administrador lo aprueba, tenerlo. Con eso alguien de Recursos Humanos podría validar su propio perfil de técnico. Hoy requiere la aprobación del administrador y la web no tiene pantalla para esas solicitudes. **No se cambia en este trabajo.**

## Enfoques considerados

**Contraseña de la cuenta nueva**

- **Invitación por correo (elegida).** Nadie más conoce la contraseña y reutiliza la recuperación existente. Depende de que el correo funcione en producción.
- Contraseña temporal escrita por el administrador. No depende del correo, pero el administrador la conoce y puede quedarse puesta.

**Cómo se expresan los permisos**

- Roles por ruta: `hasAnyRole(...)` en cada una, como hoy. Menos trabajo, pero cada rol nuevo obliga a tocar muchos archivos.
- **Permisos agrupados por rol (elegida).** Cada ruta pide un permiso y un solo mapa dice qué permisos tiene cada rol. Un rol nuevo es el nombre, una línea en el mapa y una migración.
- Roles configurables desde el panel. Un rol nuevo sin desplegar, pero es mucho para tres roles internos. Se puede añadir después sin rehacer las rutas.

## Permisos

| Permiso | Administrador | Contable | Recursos Humanos |
|---|---|---|---|
| `VER_OPERACION` | sí | sí | no |
| `GESTIONAR_CONSIGNACIONES` | sí | sí | no |
| `VER_TECNICOS` | sí | sí | sí |
| `VALIDAR_DOCUMENTACION` | sí | no | sí |
| `GESTIONAR_DISPUTAS` | sí | no | no |
| `GESTIONAR_CUENTAS` | sí | no | no |

- Backend: el enum `Permiso` y el mapa por rol son la única lista. Los permisos se calculan en cada petición a partir de los roles del token; no viajan dentro del token.
- Web: un solo archivo (`core/permisos.ts`) repite el mapa, y de él salen menú, rutas, pantalla de inicio y los roles que se pueden crear. Son dos lugares que hay que mantener iguales.
- Las rutas que solo usa el administrador y no tienen pantalla propia (incumplimientos de ETA, `GET /api/usuarios`, solicitudes de perfil, borrar técnico) siguen pidiendo el rol administrador. (Decisión del implementador.)

Por ruta, `A` administrador, `C` contable, `R` Recursos Humanos. Lo que no aparece sigue igual.

| Ruta | A | C | R |
|---|---|---|---|
| `GET /api/admin/metricas`, `GET /api/admin/ot` | sí | sí | no |
| `GET /api/ot/{id}`, `GET /api/ot/{id}/historial` (solo lectura) | sí | sí | no |
| `GET /api/admin/liquidaciones`, `.../pendientes` | sí | sí | no |
| `POST /api/admin/liquidaciones/{id}/aprobar`, `.../rechazar` | sí | sí | no |
| `GET /api/tecnicos` | sí | sí | sí |
| `GET /api/tecnicos/{id}/documentos` (**nuevo**) | sí | no | sí |
| `PATCH /api/tecnicos/{id}/validacion` | sí | no | sí |
| `GET /api/proveedores`, `GET /api/proveedores/{id}/documentos` | sí | no | sí |
| `PATCH /api/proveedores/{id}/validacion` | sí | no | sí |
| `GET /api/admin/stream` (solo avisa tipo e id) | sí | sí | sí |
| Disputas, incumplimientos de ETA, `GET /api/usuarios` | sí | no | no |
| `/api/admin/cuentas` (**nuevo**) | sí | no | no |

- Decisión del implementador: Contable lee `GET /api/tecnicos` completo (incluye datos de contacto) porque Conciliación necesita nombres y bloqueos. La alternativa es un endpoint recortado.
- En `SecurityConfig`, `/api/admin/**` sigue siendo solo administrador por defecto; las rutas con permiso se declaran antes de esa regla.
- La lectura de OT para Contable no se agrega a `exigirParticipanteOAdmin`, que también protege otras operaciones.

## Cuentas internas

**Rol nuevo:** `RECURSOS_HUMANOS`, rótulo «Recursos Humanos». Migración `V23` que reemplaza `usuario_rol_check`.

**API (solo administrador):**

| Ruta | Qué hace |
|---|---|
| `GET /api/admin/cuentas` | Lista las cuentas `CONTABLE` y `RECURSOS_HUMANOS` con nombre, correo, rol y si está activa |
| `POST /api/admin/cuentas` | Recibe nombre, correo y rol (solo esos dos valores). Responde 201; 409 si el correo ya existe |
| `PATCH /api/admin/cuentas/{id}/estado` | Desactiva o reactiva. Solo cuentas `CONTABLE` y `RECURSOS_HUMANOS` |

**Reglas:**

- La cuenta nace con una contraseña aleatoria que nadie ve.
- `habeas_data_aceptado` queda en `false`: el administrador no puede aceptar por otra persona. (Decisión del implementador.)
- Desactivar incrementa `token_version`, así la sesión abierta deja de servir.
- Un correo que ya usa un cliente, técnico o proveedor no sirve; se necesita otro.

**Invitación:** correo propio («Te crearon una cuenta en COLD DAY») con el enlace `/recuperar?token=…`, vigente 30 minutos como la recuperación. Si vence, la persona usa «Recuperar contraseña» desde el login. Se envía por el mismo transporte de correo configurado.

## Panel web

| Rol | Entra a | Menú |
|---|---|---|
| Administrador | Torre de control | Todo, más **Cuentas** |
| Contable | Torre de control | Torre de control, Conciliación, Monitoreo |
| Recursos Humanos | Auditoría de técnicos | Auditoría de técnicos, Proveedores |

- Pantalla nueva `admin/cuentas`: lista, formulario (nombre, correo, rol), desactivar y reactivar. Al crear dice a qué correo se envió la invitación y qué hacer si no llega; no promete que llegó.
- Auditoría de técnicos: carga los documentos del endpoint nuevo. Se quita el enlace «Ver», porque no hay archivo.
- Proveedores: muestra los documentos de cada pendiente. Recursos Humanos no ve la sección de incumplimientos.
- Datos de prueba: un usuario de Recursos Humanos en el sembrador (`rrhh@coldday.com.co`) y en el modo mock.

## Antes de usarlo en producción

El correo tiene que funcionar. Se comprueba pidiendo «Recuperar contraseña» con un correo propio en producción, y revisando que `MAIL_RESET_URL_BASE` apunte a la web.

## Cómo se comprueba

- Backend: pruebas por rol de cada fila de la tabla (permitido y 403), y de crear, duplicado, desactivar y reactivar. Necesitan Docker, que no está en este equipo: corren en CI.
- Web: pruebas de rutas, menú, redirección por rol y las pantallas tocadas.
- `npm run ui:check` y `node backend/scripts/check-backend-rules.mjs` sin que suba ningún techo.
