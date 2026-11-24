# Diseño: copy limpio, identidad visual y sonidos de notificación (app móvil)

Fecha: 2026-11-24 · Estado: pendiente de aprobación · Rama de trabajo: `feat/mobile-navegacion-push`

## Intención

La app móvil tiene párrafos de ayuda que repiten lo que ya dicen los títulos y los controles; usa el icono por defecto de Capacitor; y sus notificaciones push suenan igual para todo. Se quiere una app más directa, con la identidad de Cold Day y notificaciones que el usuario distinga de oído.

## Objetivos

1. Textos explícitos y cortos: se eliminan los de relleno y se reescriben los que avisan de un bloqueo, un error o un estado.
2. Icono de la app, pantalla de inicio (splash), icono de notificación y logo dentro de la app con el logotipo propio.
3. Dos sonidos distintos en Android, según rol y tipo de evento.
4. Que existan los push que justifican esos sonidos (hoy no existen para presupuesto ni aceptación).

## No objetivos

- No se tocan iOS, la web (`frontend/src`) ni la landing.
- No se redefine el sistema de diseño ni se añaden dependencias al proyecto.
- No se notifica el rechazo de presupuesto ni otros eventos no listados abajo (candidatos para una tarea posterior).
- No se revisan títulos y subtítulos de `cd-page`; solo los párrafos `cd-ayuda`, `cd-muted` y `cd-alerta__texto`.

## Antiobjetivos (fallaría aunque compile)

- Perder un aviso que explica un bloqueo (por ejemplo, "no puedes tomar servicios por una liquidación pendiente").
- Que app y backend queden con ids de canal distintos y la notificación pierda el sonido.
- Que el cuerpo del push lleve datos personales (nombre, dirección). Solo categoría y código de la OT, como hoy.
- Subir techos de `ui-rules.baseline.json` o `backend-rules.baseline.json`.

## Restricciones (de `AGENTS.md`)

- Una tarea, un commit, con su Definición de hecho. Backend y UI en commits separados.
- Ejecutar `npm run ui:check` y `node backend/scripts/check-backend-rules.mjs` antes y después.
- Copy en tuteo, español de Colombia (hoy hay un "Elegí" con voseo en `calificar`).
- No inventar texto de políticas ni cifras.
- `frontend/.env` → `MOBILE_API_ORIGIN` debe apuntar a producción antes de `mobile:build`, `mobile:apk` o `mobile:aab`.
- Sin `eslint-disable`, `@Disabled`, `it.skip`. Los tests existentes se cambian solo si la tarea cambia ese comportamiento (el adaptador FCM y su test sí cambian).

## Enfoques considerados

**Sonidos y canales**

1. **Cuatro canales fijos que la app crea al activar el push; el backend elige canal por rol y evento. (Elegido.)** El sonido de un canal de Android no se puede cambiar una vez creado. Con cuatro canales fijos, cambiar de rol en el mismo celular no rompe nada.
2. Dos canales creados según el rol al iniciar sesión. Descartado: si el mismo celular cambia de rol, conserva el sonido del anterior.
3. Mandar el sonido en el mensaje FCM. Descartado: Android 8 o superior lo ignora y usa el del canal.

**Iconos**

1. **`npx @capacitor/assets` una sola vez, sin tocar `package.json`. (Elegido.)** El usuario lo autorizó.
2. Dependencia de desarrollo. Descartado: `AGENTS.md` pide no cambiar dependencias.

**Alcance de push**

Elegido por el usuario: todo junto (sonidos + los push nuevos), en tareas separadas y ordenadas.

## Diseño

### 1. Copy (tarea de UI)

Origen: tabla revisada con el usuario en la conversación. Resumen de decisiones, por pantalla:

- **calificar:** "Podrás calificar cuando el servicio termine. Estado: X." · "Ya calificaste esta orden." · se elimina "Elegí de 1 a 5 estrellas…".
- **diagnóstico:** "Sin dictamen del técnico aún."
- **documentos-proveedor:** se elimina el párrafo de "metadata… no hay subida de archivos".
- **ejecución-ot:** "Esperando el pago de la visita para iniciar el desplazamiento." · "Sin resultados. Agrégalo manualmente." · "Acta enviada al cliente."
- **liquidaciones:** "Registra la consignación en la web. Hasta entonces no puedes tomar servicios." · "Sube o renueva documentos desde la web."
- **ofertas-técnico:** "Documentación sin aprobar: no puedes aceptar ofertas." · el aviso de liquidaciones se unifica con el de liquidaciones.
- **pago-acta:** "Podrás firmar el acta cuando el técnico cierre el servicio. Estado: X." · "Sin acta registrada."
- **panel-técnico:** "Validación en curso. Podrás aceptar ofertas cuando aprueben tus documentos." · ubicación: "Reportando por la OT en curso." / "Visible para clientes cercanos." / "Apagada: no recibes ofertas." · se elimina "Se mantiene activo mientras tienes una OT en curso." · "Liquidación pendiente. Registra la consignación en la web para tomar servicios." · "Bloqueada con una OT en curso." · se elimina "Toca para abrir la ejecución".
- **perfil-técnico:** "Elige al menos una. Define las ofertas que recibes." · se elimina el párrafo de "Tus documentos… tab Gestión".
- **solicitudes-proveedor:** "Documentación en revisión: aún no puedes aceptar pedidos."

Se mantienen sin cambio los estados de carga ("Cargando…"), los mensajes dinámicos del backend y los datos ("N en verificación · N aprobadas"). Los `data-testid` se conservan; los specs que comparen texto exacto se actualizan porque la tarea cambia ese comportamiento.

### 2. Identidad visual (tarea de UI)

- Fuente: `frontend/resources/logotipo.svg`: un trazado vectorial de un solo color (negro), con un cuadrado de esquinas redondeadas y el copo calado. Hay que separar los subtrazados para obtener el copo solo.
- Paleta (decisión mía, tomada de `DESIGN.md`): fondo `#0b1220` (`--cd-canvas`), copo `#22d3ee` (`--cd-action`).
- Archivos a producir en `frontend/resources/`: `icon-foreground.png` (1024², transparente, contenido dentro de ~660 px centrales), `icon-background.png` o color de fondo, `icon-only.png` (1024², sin transparencia), `splash.png` (2732², logo ~1200 px centrado), `splash-dark.png` si hace falta, `icono-notificacion.svg` y su PNG 96² blanco sobre transparente.
- Generar con `npx @capacitor/assets generate --android` y versionar los resultados en `frontend/android/app/src/main/res/`. Verificar la versión y las banderas al ejecutar.
- Icono de notificación: declararlo como `default_notification_icon` en `AndroidManifest.xml` (más color de acento) y colocar el recurso en `res/drawable-*`.
- Logo dentro de la app: reemplazar la marca de texto de `cd-marca` por el SVG recoloreado con tokens del tema.

### 3. Sonidos y canales (tarea de app + tarea de backend)

Archivos: `switch_006.ogg` y `switch_007.ogg` del pack Kenney Interface Sounds (CC0), copiados a `frontend/android/app/src/main/res/raw/`. Origen actual: `C:\Users\SENA\Downloads\kenney_interface-sounds\Audio\`. Sonido A = 006, sonido B = 007 (decisión mía; invertible).

| Canal | Quién | Evento | Sonido |
|---|---|---|---|
| `ot_nueva_tec` | técnico | nueva oferta de OT | 007 |
| `ot_update_tec` | técnico | actualización de la OT en curso (el cliente aprueba el presupuesto) | 006 |
| `ot_nueva_cli` | cliente | el técnico envía presupuesto · un técnico acepta la OT | 006 |
| `ot_update_cli` | cliente | otras actualizaciones (hoy: despacho sin técnico) | 007 |

- App (`core/push.ts`): crear los cuatro canales (importancia 5, `sound` con el nombre del recurso) antes de `register()`. Actualizar `CANAL_PUSH` y su spec.
- Backend: `FcmSender.enviar` recibe el canal; `FirebaseFcmSender` lo pone en `AndroidNotification`. El adaptador elige canal por rol y evento. El canal `ofertas` deja de usarse. Un celular con la app vieja y backend nuevo recibe el aviso en el canal de respaldo de FCM, sin sonido propio (confirmar en prueba).
- Despliegue: app nueva y backend a la vez. No cambian las variables de entorno ni el proyecto de Firebase.

### 4. Push nuevos (tarea de backend)

Se amplía `NotificacionPushPort` y los dos adaptadores (FCM y logging) para tres eventos, sin datos personales en el cuerpo:

- **Presupuesto enviado** → cliente, canal `ot_nueva_cli`. Punto de enganche: `RegistrarDiagnosticoUseCase` (llama a `ot.presupuestar(...)`).
- **OT aceptada por un técnico** → cliente, canal `ot_nueva_cli`. Punto de enganche: `AceptarOfertaUseCase`.
- **Presupuesto aprobado** → técnico, canal `ot_update_tec`. Punto de enganche: `AprobarPresupuestoUseCase`.

Ajuste decidido al planificar: en vez de tocar los tres casos de uso, un listener `AFTER_COMMIT` reacciona a los eventos de dominio que ya existen (`OtAsignada` y `OtEstadoCambiado`, este último lo publica `OtRepositoryAdapter.save` en cada transición). Así los casos de uso y sus constructores no cambian, y el push nunca sale antes del commit.

Reglas: un fallo de push nunca rompe el caso de uso (mismo patrón de hoy: se traga y se loguea). El push se envía después de persistir. Cada mensaje lleva `ruta` y `otId`, como hoy, para que `rutaDeNotificacion` en `push.ts` navegue al tocar.

## Orden de tareas (un commit cada una)

1. Copy de la app móvil.
2. Iconos y logo.
3. Canales y sonidos: app y backend (`FcmSender`, `FirebaseFcmSender`, adaptador, tests).
4. Push nuevos de presupuesto, aceptación y aprobación (puerto, adaptadores, casos de uso, tests).

## Verificación

- `npm run ui:check` y `npm run mobile:test` y `mobile:build` (tareas 1 a 3).
- `node backend/scripts/check-backend-rules.mjs` y `.\gradlew.bat build` con Docker (tareas 3 y 4).
- En un celular Android real: instalar el APK, provocar cada evento y comprobar el sonido. Esto no se puede automatizar y se reporta como verificado a mano o no verificado.

## Pendiente para quien construya

- Confirmar en el código que `RegistrarDiagnosticoUseCase` es el único punto donde se "envía" el presupuesto.
- Definir el texto de título y cuerpo de cada push nuevo (sin datos personales, tuteo).
- Elegir los puntos exactos de recorte de los subtrazados del SVG para aislar el copo.
- Si faltan tamaños en la salida de `@capacitor/assets`, completarlos.
