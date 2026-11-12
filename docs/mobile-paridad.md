# Paridad funcional: web (Vercel) → móvil (Ionic)

Mapeo del frontend **web que está desplegado en Vercel** (`frontend/src/app`, 25 páginas)
contra la app **móvil** (`frontend/projects/mobile/src/app`, 18 páginas).

Criterio: la app móvil es para **cliente, técnico y proveedor**; administración y
contabilidad siguen en la web (pantalla `solo-web`). Eso no es una falta: es diseño.

## Resumen

| Estado | Cantidad |
|---|---|
| ✅ Implementado en móvil | 16 |
| 🟡 Placeholder (ruta y tab existen, pantalla no) | 1 |
| ❌ Falta en móvil | 0 |
| ⛔ Web por diseño (admin/contable) | 6 |
| ➕ Solo móvil (sin equivalente web) | 4 |

## Matriz pantalla por pantalla

| Web (Vercel) | Ruta web | Móvil | Estado |
|---|---|---|---|
| Login | `/login` | `login` | ✅ |
| Registro (3 roles) | `/registro` | `registro` | ✅ |
| Recuperar contraseña | `/recuperar` | `recuperar` | ✅ |
| Completar perfil cliente | `/perfil/agregar` | dentro de `solicitar-servicio` | ✅ (flujo distinto: el perfil se crea al confirmar la solicitud) |
| Dispatcher de rol | `/panel` | `modo.guards` + `cuenta` | ✅ (por guard, sin pantalla) |
| Panel cliente | `/cliente/panel` | `cliente/panel` | ✅ |
| Solicitar servicio | `/cliente/solicitar` | `cliente/solicitar` | ✅ |
| Seguimiento OT | `/cliente/ot/:id` | `cliente/ot/:id` | ✅ |
| Diagnóstico y presupuesto | `/cliente/ot/:id/diagnostico` | `cliente/ot/:id/diagnostico` | ✅ |
| Pago y acta | `/cliente/ot/:id/pago` | `cliente/ot/:id/pago` | ✅ |
| Calificar servicio | `/cliente/ot/:id/calificar` | `cliente/ot/:id/calificar` | ✅ |
| **Mis equipos** | `/cliente/equipos` | `cliente/equipos` | 🟡 placeholder |
| Panel técnico | `/tecnico/panel` | `tecnico/ots` | ✅ |
| Radar de ofertas | `/tecnico/ofertas` | `tecnico/radar` | ✅ |
| Ejecución de OT | `/tecnico/ejecucion/:id` | `tecnico/ejecucion/:id` | ✅ |
| Perfil técnico | `/tecnico/perfil` | `tecnico/perfil` | ✅ |
| Acreditaciones y documentos | `/tecnico/documentos` | dentro de `tecnico/perfil` | ✅ (misma pantalla B4: `getMisDocumentos`) |
| Liquidaciones del técnico | `/tecnico/liquidaciones` | `/tecnico/liquidaciones` | ✅ (CTA desde el panel; el nav de Stitch tiene 3 destinos) |
| Panel proveedor | `/proveedor/panel` | `proveedor/insumos` | ✅ |
| Documentos proveedor | `/proveedor/documentos` | `proveedor/documentos` | ✅ |
| Dashboard admin | `/admin/dashboard` | — | ⛔ web |
| Validación de técnicos | `/admin/validacion-tecnicos` | — | ⛔ web |
| Consignaciones admin | `/admin/consignaciones` | — | ⛔ web |
| Disputas admin | `/admin/disputas` | — | ⛔ web |
| Monitoreo de OTs | `/admin/monitoreo` | — | ⛔ web |
| Proveedores admin | `/admin/proveedores` | — | ⛔ web |

### Solo móvil (no existe en la web)

| Pantalla | Ruta | Para qué |
|---|---|---|
| Cuenta | `/cuenta`, `*/cuenta` | Datos de sesión + selector de modo (los 3 roles, deshabilitados con explicación si no aplica) |
| Usá la web | `/solo-web` | Salida explicada para admin/contable en vez de un 403 |
| Shell de tabs | `/<modo>` | Navegación por modo (cliente 3, técnico 3, proveedor 3) |
| Placeholder | leaf sin pantalla | Inventario de lo que falta, con copy y tab ya fijados |

## Qué falta, en orden de necesidad

1. **Mis equipos** (`cliente/equipos`). Es el único placeholder que queda. Bajo
   valor comparado con lo demás: el historial de equipos se consulta en la web y
   el flujo de solicitud no lo necesita. Tiene export de Stitch
   (`a10_mis_equipos`), así que el diseño ya existe cuando se decida hacerlo.

## Permisos nativos

Los plugins de Capacitor **no declaran sus permisos** en sus manifiestos: eso se
hace en `android/app/src/main/AndroidManifest.xml`. Sin la declaración, Android
deniega al instante **sin mostrar diálogo** y la app solo puede avisar "permiso
denegado" — era el síntoma reportado en el APK.

Declarados y verificados en el manifiesto fusionado del APK:

| Permiso | Lo usa | Efecto |
|---|---|---|
| `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` | `@capacitor/geolocation` | El radar y la ubicación de la solicitud piden permiso al sistema |
| `CAMERA` | `@capacitor/camera` | "Sacar foto" en la ejecución de OT pide permiso |
| `INTERNET` | WebView | Ya estaba |

Además se marcan `uses-feature` de GPS y cámara como `required="false"` para que
Play no filtre la app por hardware ausente.

## Notas de arquitectura compartida

- Ambos proyectos comparten `@core/*` (modelos, APIs, guards, interceptores):
  la capa de datos es **la misma**, no hay duplicación de contratos.
- El móvil no usa `@capacitor/preferences` para nada crítico salvo el token
  (persistencia propia); el resto del estado vive en memoria.
- El backend es el mismo; la diferencia es el origen (`API_ORIGIN` en web,
  `MOBILE_API_ORIGIN` en móvil) y que la web usa rutas relativas en dev.

Generado el 2026-11-10 revisando `app.routes.ts` de ambos proyectos y las
carpetas de páginas. Mantener este archivo cuando se agregue una pantalla.
