# NAVEGACION.md — mapa de la app móvil, huecos y homogeneidad

Complementa a [`/DESIGN.md`](../../DESIGN.md) (reglas visuales y de patrón). Aquí vive lo que `DESIGN.md` no puede decir con reglas: **qué hay, desde dónde se llega y qué falta**. Se actualiza **en el mismo commit** que añade, mueve o quita una pantalla, una ruta o un punto de entrada.

> Origen: se detectó que la pantalla de especialidades del técnico (`/tecnico/perfil`) solo se alcanzaba desde un botón del panel y no desde Cuenta. Ninguna regla visual lo podía detectar. Este archivo es esa red de seguridad (regla UI-N1 en `DESIGN.md` §4).

Última revisión: 2026-11-23 (código: `app.routes.ts`, `modo/modo.ts`, `pages/*`).

---

## 1. Mapa por rol

Tabs = `MODOS[modo].tabs` en `frontend/projects/mobile/src/app/modo/modo.ts`. «Entrada» = desde dónde se llega; toda pantalla de negocio debe tener **al menos una** y un **volver** al padre lógico real.

### Cliente — home `/cliente/panel`

| Pantalla | Ruta | Entrada | Volver a | Diseño |
|---|---|---|---|---|
| Panel (tab) | `/cliente/panel` | tab | — | A4 |
| Mis equipos (tab) | `/cliente/equipos` | tab | — | A10 |
| Cuenta (tab) | `/cliente/cuenta` | tab | — | A3 |
| Solicitar servicio (3 pasos) | `/cliente/solicitar` | CTA del panel · CTA de equipos | panel | A5-1/2/3 |
| Seguimiento de OT | `/cliente/ot/:id` | tarjeta del panel · tarjeta de equipos · al crear la OT | panel (`defaultHref`) | A6 |
| Diagnóstico y presupuesto | `/cliente/ot/:id/diagnostico` | seguimiento | seguimiento | A7 |
| Pago y acta | `/cliente/ot/:id/pago` | seguimiento | seguimiento | A8 |
| Calificar | `/cliente/ot/:id/calificar` | seguimiento | seguimiento | A9 |

### Técnico — home `/tecnico/radar`

| Pantalla | Ruta | Entrada | Volver a | Diseño |
|---|---|---|---|---|
| Radar de ofertas (tab) | `/tecnico/radar` | tab · atajo del panel | — | B1 |
| Mis OTs / panel (tab) | `/tecnico/ots` | tab · al aceptar oferta | — | B0 / B2 |
| Gestión: liquidaciones + documentos (tab, id `liquidaciones`, icono carpeta) | `/tecnico/liquidaciones` | tab | — | C2 (documentos) |
| Cuenta (tab) | `/tecnico/cuenta` | tab | — | A3 |
| Ejecución de OT | `/tecnico/ejecucion/:id` | tarjeta de Mis OTs · al aceptar oferta | Mis OTs («Volver a Mis OTs») | B3 |
| Perfil técnico (especialidades, matrícula) | `/tecnico/perfil` | **fila «Mi perfil técnico» en Cuenta** (único acceso; se quitó el botón del panel) | Cuenta | B4 |

### Proveedor — home `/proveedor/insumos`

| Pantalla | Ruta | Entrada | Volver a | Diseño |
|---|---|---|---|---|
| Insumos / bandeja (tab) | `/proveedor/insumos` | tab | — | C0 / C1 |
| Documentos (tab) | `/proveedor/documentos` | tab | — | C2 |
| Cuenta (tab) | `/proveedor/cuenta` | tab | — | A3 |

### Sin sesión / comunes

| Pantalla | Ruta | Notas |
|---|---|---|
| Login | `/login` | enlace a registro |
| Registro (3 perfiles) | `/registro` | vuelve a login |
| Cuenta canónica | `/cuenta` | misma pantalla que `*/cuenta`, fuera de tabs |
| Solo web | `/solo-web` | admin/contable: salida explicada, no 403 |
| URL desconocida con sesión | `/<modo>/**` | redirige al home del modo (no al login) |
| URL desconocida sin sesión | `**` | login |

---

## 2. Huecos de funcionalidad detectados (frontend)

Ordenados por impacto en el usuario. «Backend» = bloqueado por datos; **no se pinta un número que el backend no entrega** (`PRODUCT.md`).

| # | Hueco | Rol | Estado | Qué hace falta |
|---|---|---|---|---|
| F1 | **Recuperar contraseña** no existe en móvil (la web tiene `/recuperar`; `mobile-paridad.md` lo daba por hecho y era falso) | todos | Falta | Pantalla `recuperar` + enlace «¿Olvidaste tu contraseña?» en login. Contrato ya existe en `@core` (verificar) |
| F2 | Cuenta no permite **editar datos** (nombre, teléfono) ni **cambiar contraseña** | todos | Falta | Sección «Tus datos» y «Seguridad» en `cuenta`; confirmar endpoints |
| F3 | Proveedor sin pantalla de **perfil/empresa**; Cuenta es lo único | proveedor | Falta | Fila «Mi empresa» análoga a «Mi perfil técnico» (documentos ya viven en su tab) |
| F4 | Cliente sin **A3.1 completar perfil** como paso propio (self-adopt de perfil cliente) | cliente | Parcial | El backend lo soporta; hoy el perfil se crea al confirmar la solicitud |
| F5 | **Countdown** «Expira en» del radar no avanza (muestra el snapshot) | técnico | Bug de reactividad | Ticker local + recarga al llegar a 0 |
| F6 | Bandeja del proveedor sin **refresher ni SSE**: solo ve nuevas solicitudes al recargar | proveedor | Falta | `ion-refresher` (inmediato); SSE después |
| F7 | `ion-refresher` solo en panel-cliente y liquidaciones | todos | Inconsistente | Aplicar a toda lista remota (ver §3) |
| F8 | **Notificaciones**. Estado (2026-11-23): **preparado, desactivado**. Hecho: backend `V19__dispositivo_push` + `POST/DELETE /api/usuarios/me/dispositivos` (con test); móvil `core/push.ts` (permiso, canal «ofertas», registro del token, abrir ruta al tocar, baja al cerrar sesión), `@capacitor/push-notifications` y permiso `POST_NOTIFICATIONS`. Adaptador FCM del backend hecho (`FcmNotificacionPushAdapter`, activo con `FCM_ENABLED=true`). Falta solo el setup: `google-services.json` en `frontend/android/app/`, `PUSH.habilitado = true` y la cuenta de servicio en el entorno del backend. Hasta entonces solo hay toasts con la app abierta y **no se pinta** campana | todos | Firebase + backend | Ver cabecera de `core/push.ts` |
| F9 | **Chat** con el técnico: A7 muestra «Próximamente» honesto | cliente/técnico | Backend | Backend de chat |
| F10 | **Archivos reales** (evidencias, documentos): solo metadata | técnico/proveedor | Backend | Upload |
| F11 | Copy del placeholder (`PANTALLAS` en `app.routes.ts`) está en voseo («podés», «tuyo») | todos | Deuda UI-L1 | Migrar a tuteo |

### Bloqueado por datos del backend (de `renovacion-reglas-stitch.md` §2, vigente)

| Elemento Stitch | Falta en backend |
|---|---|
| Monto en ofertas del radar | `montoEstimadoCop` en `OfertaTecnicoResponse` |
| Cotizar con monto (proveedor) | endpoint de cotización + estado COTIZADO |
| Rating «4.8 (124 servicios)» | exponer reputación en el perfil en sesión |
| Avatar con foto | campo + upload |
| KPIs de C0 | endpoints de métricas por rol |
| Matrícula junto al nombre | campo `matricula` en `TecnicoResponse` |
| Precio por línea de insumo y total autocompletado | `precio` en `InsumoLinea` |
| Catálogo de insumos | catálogo por proveedor + búsqueda |
| Posición del técnico en tiempo real | streaming (SSE/WS); hoy poll de 15 s |
| Push de expiración de ofertas | evento SSE o filtro server-side |

---

## 3. Homogeneidad: qué pantalla usa qué patrón

Medido por búsqueda de texto en `pages/*` (2026-11-23); es una guía, no una prueba. `Y` = lo usa. `n/a` = no aplica (auth, flujo sin datos remotos).

| Pantalla | Plantilla (DESIGN §5.1) | `cd-page` | `cd-marca` | Footer CTA | Skeleton | Vacío | Error | Refresher |
|---|---|---|---|---|---|---|---|---|
| panel-cliente | Cola | Y | Y | Y | Y | Y | Y | Y |
| equipos | Cola | Y | Y | Y | Y | Y | Y | — |
| cuenta | Formulario | Y | Y | — | Y | — | Y | — |
| ofertas-tecnico (radar) | Cola | Y | Y | — | Y | Y | Y | — |
| panel-tecnico (Mis OTs) | Cola | Y | Y | — | Y | Y | Y | — |
| liquidaciones-tecnico | Cola | Y | Y | — | Y | Y | Y | Y |
| solicitudes-proveedor | Cola | — | Y | — | Y | Y | Y | — |
| documentos-proveedor | Cola | — | Y | — | Y | Y | — | — |
| seguimiento-ot | Detalle | — | — | — | — | — | — | — |
| ejecucion-ot | Detalle | — | — | Y | — | — | — | — |
| perfil-tecnico | Formulario | — | — | Y | Y | — | — | — |
| diagnostico | Detalle + decisión | — | — | Y | — | — | — | — |
| pago-acta | Detalle + decisión | — | — | Y | — | — | — | — |
| calificar | Formulario | — | — | Y | — | — | — | — |
| solicitar-servicio | Asistente | — | — | Y | — | — | — | — |
| login · registro · solo-web | Auth / salida | — | — | — | n/a | n/a | n/a | n/a |

**Brechas de homogeneidad a cerrar (por prioridad):**
1. ~~`liquidaciones-tecnico` a `cd-page`~~ (hecho). Pendientes (proveedor, se retoma después según D4): `solicitudes-proveedor`, `documentos-proveedor`.
2. Las pantallas de **detalle** (`seguimiento-ot`, `ejecucion-ot`, `diagnostico`, `pago-acta`) **ya** tienen carga con spinner y error con «Reintentar» (`ot-cargando`/`ot-error`); la matriz de arriba marcaba `—` por buscar solo `cd-skeleton`. Pendiente menor: unificar su spinner con `cd-skeleton`.
3. `documentos-proveedor` sin estado de error; `perfil-tecnico` sin error.
4. ~~Volver inconsistente~~ (hecho): `ejecucion-ot` → «Volver a Mis OTs»; `perfil-tecnico` → «Volver a Cuenta» (`/tecnico/cuenta`).
5. UI-N1 automatizada: `app.routes.spec.ts` compara las rutas reales con el inventario de §1; añadir una ruta sin actualizarlo falla.

---

## 4. Decisiones del dueño

**Resueltas (2026-11-23):**

| ID | Decisión | Estado |
|---|---|---|
| D1 | El tab del cliente se llama **«Mis equipos»** (A10) | Aplicado en `modo.ts`, rutas, `cd-marca` y specs |
| D2 | **Sí** se pinta el monto real de la visita, tomado de `POST /api/ot/tarifa/estimar` | Aplicado en A6 (panel de pago y CTA); si la estimación falla o está fuera de rango no se pinta monto |
| D3 | Precios/estimados: **honesto-vacío** hasta que el backend los entregue | Vigente; el backend se acomoda después |
| D4 | Editar datos/contraseña (F2) y empresa del proveedor (F3): **sin pantalla por ahora** | Vigente; proveedores se retoma después |

**Pendientes:** ninguna. Las reglas renegociadas (KPIs condicionados a datos reales, un único pulso «live» en `cd-marca`) ya están en `DESIGN.md` §0.1.

---

## 5. Cómo mantener este archivo

1. Nueva pantalla o ruta → añade su fila en §1 (con entrada y volver) **y** en `docs/mobile-paridad.md` si tiene equivalente web.
2. Antes de dar una tarea por hecha: ¿alguna pantalla quedó **sin entrada** o con un volver que no lleva al padre? Corrige antes de entregar.
3. Un hueco resuelto se borra de §2 en el mismo commit; uno nuevo se añade con su rol y su bloqueo.
4. Si se automatiza (spec de alcanzabilidad que compare `app.routes.ts` con §1), la regla UI-N1 pasa a ser automática.
