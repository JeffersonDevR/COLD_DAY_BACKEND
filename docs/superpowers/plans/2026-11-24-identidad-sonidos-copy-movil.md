# Copy, identidad visual y sonidos de notificación (móvil) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Textos de la app móvil más directos, identidad Cold Day en el icono/splash/notificaciones, y sonidos de push distintos por rol y evento (con los push nuevos que faltan).

**Architecture:** Cuatro canales Android fijos (`ot_nueva_tec`, `ot_update_tec`, `ot_nueva_cli`, `ot_update_cli`) que la app crea con sonido propio; el backend elige canal por rol y evento. Los push nuevos salen de un listener `AFTER_COMMIT` sobre eventos de dominio ya existentes.

**Tech Stack:** Angular 21 + Ionic 9 + Capacitor 8 (Vitest), Spring Boot 4 / Java 25 (JUnit + Mockito), Firebase Admin, `npx @capacitor/assets`, Playwright (ya en devDependencies) para rasterizar SVG.

**Spec:** `docs/superpowers/specs/2026-11-24-identidad-sonidos-copy-movil-design.md`

## Global Constraints

- Leer antes de editar: `AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, `docs/backend/GUIA-BACKEND.md`. Ejecutar el verificador antes y después de cada tarea y pegar la salida: `cd frontend && npm run ui:check` (UI) y `node backend/scripts/check-backend-rules.mjs` (backend). Prohibido subir techos o editar a mano los `*.baseline.json`.
- Una tarea = un commit = su Definición de hecho (`DESIGN.md` §11 / `GUIA-BACKEND.md` §7). **No commitear salvo que el usuario lo pida** (`AGENTS.md` regla 7); el mensaje sugerido va en cada tarea, estilo `tipo(ámbito): mensaje`.
- No tocar `backend/` desde tareas de UI ni al revés. Sin nuevas dependencias en `package.json`/`build.gradle` (se autorizó solo `npx @capacitor/assets`, sin instalarlo).
- Copy en tuteo, español de Colombia. Sin `eslint-disable`, `@Disabled`, `it.skip`, `--no-verify`.
- `frontend/.env` → `MOBILE_API_ORIGIN` debe estar en producción antes de `mobile:build`/`mobile:apk`/`mobile:aab`.
- El cuerpo de un push no lleva datos personales (nombre, dirección): solo categoría y datos de la OT.
- Ids de canal (contrato app↔backend, idénticos en ambos): `ot_nueva_tec`, `ot_update_tec`, `ot_nueva_cli`, `ot_update_cli`. Sonidos: `switch_006.ogg` (A) y `switch_007.ogg` (B), de `C:\Users\SENA\Downloads\kenney_interface-sounds\Audio\` (CC0).
- Paleta del icono: fondo `#0b1220`, copo `#22d3ee`.

## Review Focus

Entradas o condiciones que el spec no cubre en sus tareas y que más probablemente fallarían:

1. Una transición de OT que no merece push (`ASIGNADA → EN_CAMINO`, cancelaciones) no debe enviar nada. → test en Task 5.
2. OT sin técnico o sin cliente al momento del evento, o el repositorio lanza al cargar la OT: el listener no lanza ni envía. → tests en Task 5.
3. Usuario sin dispositivos registrados o con permiso de notificaciones denegado: sin error. → ya cubierto en `FcmNotificacionPushAdapterTest` (Task 3 lo conserva) y en `push.ts` (rama `permiso.receive !== 'granted'`).
4. El pack de sonidos falta en `res/raw`: el canal queda silencioso sin avisar. → comprobación manual con `Test-Path` en Task 4.
5. El logo recortado por la máscara circular de Android (zona segura). → revisión visual en Task 2.

---

### Task 1: Copy de la app móvil

**Files:**
- Modify: los 11 `*.page.html` de `frontend/projects/mobile/src/app/pages/` (calificar, diagnostico, documentos-proveedor, ejecucion-ot, liquidaciones-tecnico, ofertas-tecnico, pago-acta, panel-tecnico, perfil-tecnico, solicitudes-proveedor) según la tabla.
- Test: `panel-tecnico/panel-tecnico.page.spec.ts` (línea ~216 espera "Tus ofertas llegan a los clientes cercanos"), `diagnostico/diagnostico.page.spec.ts` (línea ~145 espera "El técnico todavía no cargó el dictamen"). Buscar con Grep otros specs de `projects/mobile` que citen un texto de la tabla o un `data-testid` que se elimina (`switch-bloqueado`).

**Interfaces:** Consumes: nada. Produces: nada (solo texto).

- [ ] **Step 1: Ejecutar `cd frontend && npm run ui:check`** y guardar la salida como línea base de la tarea.
- [ ] **Step 2: Actualizar los specs primero.** En `panel-tecnico.page.spec.ts` cambiar la expectativa a `'Visible para clientes cercanos.'` y añadir `expect(texto(fixture)).not.toContain('Toca para abrir la ejecución')` en el caso con OT en curso. En `diagnostico.page.spec.ts` cambiar a `'Sin dictamen del técnico aún.'` (la línea del presupuesto no cambia). Si un spec referencia `switch-bloqueado`, quitar esa aserción (el nodo se elimina).
- [ ] **Step 3: Correr `npx ng test mobile --watch=false --include "**/panel-tecnico.page.spec.ts"` (y diagnóstico).** Debe FALLAR por los textos nuevos. Si `--include` no se acepta, usar `npm run mobile:test`.
- [ ] **Step 4: Aplicar la tabla.** Conservar todos los `data-testid` salvo `switch-bloqueado`; mantener los `{{ … }}` dinámicos.

| Pantalla | Texto actual | Texto nuevo |
|---|---|---|
| calificar | "La calificación se habilita cuando el servicio está finalizado. Estado actual: X." | "Podrás calificar cuando el servicio termine. Estado: X." |
| calificar | "Solo se registra una reseña por orden de trabajo." | "Ya calificaste esta orden." |
| calificar | `<p class="cd-muted">Elegí de 1 a 5 estrellas. Sin puntaje…` | **eliminar el párrafo** |
| diagnostico | "El técnico todavía no cargó el dictamen de este equipo." | "Sin dictamen del técnico aún." |
| documentos-proveedor | `<p class="cd-ayuda">El backend guarda solo la metadata…` | **eliminar el párrafo** |
| ejecucion-ot | "El cliente debe pagar la visita antes de que puedas iniciar el desplazamiento." | "Esperando el pago de la visita para iniciar el desplazamiento." |
| ejecucion-ot | "Sin resultados en el catálogo. Agrégalo manualmente abajo." | "Sin resultados. Agrégalo manualmente." |
| ejecucion-ot | "El cliente ya puede ver el acta y calificar el servicio." | "Acta enviada al cliente." |
| liquidaciones-tecnico | "La consignación se registra desde la web. Mientras haya una pendiente no puedes tomar servicios nuevos." | "Registra la consignación en la web. Hasta entonces no puedes tomar servicios." |
| liquidaciones-tecnico | "Para subir o renovar un documento usa la web hasta que la app tenga cámara y subida de archivos." | "Sube o renueva documentos desde la web." |
| ofertas-tecnico | "Tu documentación está pendiente de aprobación o fue rechazada. Puedes completar tu perfil desde la web." | "Documentación sin aprobar: no puedes aceptar ofertas." |
| ofertas-tecnico | "Tienes liquidaciones pendientes. Regularízalas desde la web para volver a tomar servicios." | "Liquidación pendiente. Registra la consignación en la web para tomar servicios." |
| pago-acta | "La orden está en estado X. Cuando el técnico cierre el servicio vas a poder firmar el acta desde acá; hasta entonces el botón queda deshabilitado." | "Podrás firmar el acta cuando el técnico cierre el servicio. Estado: X." |
| pago-acta | "Sin firmar — aún no hay acta registrada" | "Sin acta registrada." |
| panel-tecnico | "Cuando el equipo apruebe tus documentos vas a poder aceptar ofertas. Mientras tanto puedes completar tu perfil." | "Validación en curso. Podrás aceptar ofertas cuando aprueben tus documentos." (el `<h2>` "Validación en curso" ya existe: dejar solo la frase tras el punto) |
| panel-tecnico | "Reportando automáticamente por la OT en curso." / "Tus ofertas llegan a los clientes cercanos." / "Ubicación apagada: no aparecerás en las ofertas." | "Reportando por la OT en curso." / "Visible para clientes cercanos." / "Apagada: no recibes ofertas." |
| panel-tecnico | bloque `switch-bloqueado` "Se mantiene activo mientras tienes una OT en curso." | **eliminar el bloque** |
| panel-tecnico | "Tienes liquidaciones pendientes. Revisa el tab Gestión y registra la consignación desde la web…" | "Liquidación pendiente. Registra la consignación en la web para tomar servicios." |
| panel-tecnico | "Con una OT en curso no puedes cambiar la disponibilidad." | "Bloqueada con una OT en curso." |
| panel-tecnico | `<span class="cd-ayuda">Toca para abrir la ejecución</span>` | **eliminar el span** |
| perfil-tecnico | "Elige al menos una. Las ofertas que recibes dependen de esto." | "Elige al menos una. Define las ofertas que recibes." |
| perfil-tecnico | `<p class="cd-ayuda">Tus documentos de validación se consultan en el tab Gestión…` | **eliminar el párrafo** |
| solicitudes-proveedor | "Un administrador revisa tu documentación. Mientras tanto no puedes aceptar pedidos de insumos." | "Documentación en revisión: aún no puedes aceptar pedidos." |

- [ ] **Step 5: Correr `npm run ui:check && npm run mobile:test && npm run mobile:build`.** Esperado: verde, sin regla que SUBA. Si queda CSS sin uso (p. ej. `.cd-ubicacion__nota`), no tocarlo salvo que ui:check lo exija.
- [ ] **Step 6: Commit sugerido (solo si el usuario lo pide):** `feat(mobile): copy mas directo, sin texto de relleno`

---

### Task 2: Icono, splash, icono de notificación y logo en la app

**Files:**
- Create: `frontend/resources/logo-copo.svg` (copo aislado, cian sobre transparente), `icon-only.png` (1024², fondo `#0b1220`), `icon-foreground.png` (1024², transparente), `splash.png` (2732², fondo `#0b1220`, copo ~1200 px centrado), `frontend/projects/mobile/public/logo-copo.svg` (copia para la app).
- Modify: `frontend/android/app/src/main/res/**` (salida de `@capacitor/assets` + `drawable-*/ic_stat_cold_day.png`), `frontend/android/app/src/main/AndroidManifest.xml`, `frontend/android/app/src/main/res/values/colors.xml`, `frontend/projects/mobile/src/app/shared/ui/marca-barra/marca-barra.ts` (+ su spec si existe).

**Interfaces:** Produces: recurso `@drawable/ic_stat_cold_day`, color `@color/cd_notificacion` (`#22d3ee`).

- [ ] **Step 1: Aislar el copo.** `logotipo.svg` es un solo `<path>` potrace: su primer subtrazado (hasta el primer `z`, termina en `…-3z`) es el cuadrado exterior y el resto son los brazos del copo (huecos). Crear `logo-copo.svg` con `<mask>`: dentro del mismo `<g transform="translate(0 1024) scale(.1 -.1)">`, un `<path fill="#fff">` con SOLO el primer subtrazado y encima el `<path fill="#000">` con el `d` completo; aplicar la máscara a un `<rect>` cian `#22d3ee`. Resultado: solo el copo visible. Abrirlo en el navegador integrado y confirmar que se ve el copo sin cuadrado.
- [ ] **Step 2: Rasterizar con Playwright** (script suelto en el scratchpad, no en el repo): cargar el SVG en una página, `page.screenshot({ omitBackground: true })` a 1024² (primer plano: escalar el copo para que su `getBBox` mida ≤ 660 px de ancho, centrado), `icon-only.png` (mismo copo sobre rect `#0b1220` de 1024², sin transparencia) y `splash.png` (2732², copo ~1200 px). Guardar los tres en `frontend/resources/`.
- [ ] **Step 3: Generar los recursos Android:** `cd frontend && npx @capacitor/assets generate --android --iconBackgroundColor "#0b1220" --iconBackgroundColorDark "#0b1220" --splashBackgroundColor "#0b1220" --splashBackgroundColorDark "#0b1220"` (verificar banderas con `--help`). Comprobar con Glob que cambiaron los `mipmap-*/ic_launcher*.png` y `drawable*/splash.png`, y que no se modificó `package.json` (`git diff --stat frontend/package.json` vacío).
- [ ] **Step 4: Revisión de zona segura.** Abrir `icon-foreground.png` con una máscara circular de radio 33/54 del lado (66 dp sobre 108 dp) y confirmar que el copo no se corta.
- [ ] **Step 5: Icono de notificación.** Con Playwright, renderizar el copo en blanco `#ffffff` sobre transparente a 24, 36, 48, 72 y 96 px y guardarlos como `drawable-mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi/ic_stat_cold_day.png`. En `AndroidManifest.xml`, dentro de `<application>`, añadir `<meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_cold_day" />` y `<meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/cd_notificacion" />`; añadir `<color name="cd_notificacion">#22d3ee</color>` a `values/colors.xml` (crearlo si no existe).
- [ ] **Step 6: Logo en la app.** Copiar `logo-copo.svg` a `frontend/projects/mobile/public/`. En `marca-barra.ts` reemplazar `<ion-icon name="snow-outline">` por `<img src="logo-copo.svg" alt="" width="20" height="20" />` dentro de `.cd-marca__logo` (decorativo: `aria-hidden` ya está en el `span`). Si existe `marca-barra.spec.ts`, añadir la aserción `expect(compiled.querySelector('.cd-marca__logo img')).not.toBeNull()` y que no haya `ion-icon[name="snow-outline"]`; si no existe, no crear spec nuevo.
- [ ] **Step 6b: Correr `npm run ui:check && npm run mobile:test && npm run mobile:build`** y verificar `MOBILE_API_ORIGIN` en producción antes del build. Esperado: verde.
- [ ] **Step 7: Commit sugerido (solo si el usuario lo pide):** `feat(mobile): icono, splash y logo de Cold Day`

---

### Task 3: Backend — canales por rol y evento

**Files:**
- Create: `backend/src/main/java/com/sena/cold_day/core/modules/ot/infrastructure/notification/CanalPush.java`
- Modify: `FcmSender.java`, `FirebaseFcmSender.java`, `FcmNotificacionPushAdapter.java` (mismo paquete `…/ot/infrastructure/notification/`).
- Test: `backend/src/test/java/…/ot/infrastructure/notification/FcmNotificacionPushAdapterTest.java`, create `CanalPushTest.java` (mismo paquete).

**Interfaces:**
- Produces: `enum CanalPush { OT_NUEVA_TEC, OT_UPDATE_TEC, OT_NUEVA_CLI, OT_UPDATE_CLI; String id() }` (package-private) con ids `ot_nueva_tec`, `ot_update_tec`, `ot_nueva_cli`, `ot_update_cli`.
- Produces: `FcmSender.enviar(String token, CanalPush canal, String titulo, String cuerpo, Map<String,String> datos, Consumer<String> tokenInvalido)` (el canal va tras el token).
- Produces: en `FcmNotificacionPushAdapter`, el método privado `enviar(Long usuarioId, CanalPush canal, String titulo, String cuerpo, Map<String,String> datos)`.

- [ ] **Step 1: Ejecutar `node backend/scripts/check-backend-rules.mjs`** y guardar la salida.
- [ ] **Step 2: Tests que fallan.** `CanalPushTest.idsCoincidenConLaApp`: `assertEquals(List.of("ot_nueva_tec","ot_update_tec","ot_nueva_cli","ot_update_cli"), Arrays.stream(CanalPush.values()).map(CanalPush::id).toList())`. En `FcmNotificacionPushAdapterTest`: `notificaOfertaATodosLosDispositivosDelTecnico` verifica `sender.enviar(eq("tok-a"), eq(CanalPush.OT_NUEVA_TEC), eq("Nueva oferta de servicio"), anyString(), eq(Map.of("ruta","/tecnico/radar","otId",…)), any())`; añadir `notificarClienteUsaCanalDeActualizacion` que stubbee `clientes.buscarPorId` con un cliente cuyo `getUsuarioId().valor()` sea `9L` y verifique `CanalPush.OT_UPDATE_CLI`. Actualizar los demás `verify(sender…)` a la firma nueva con `any()` en la posición del canal.
- [ ] **Step 3: Correr `.\gradlew.bat test --tests "*FcmNotificacionPushAdapterTest" --tests "*CanalPushTest"`** (desde `backend/`). Esperado: FAIL de compilación.
- [ ] **Step 4: Implementar** `CanalPush`, la firma nueva en `FcmSender`, y en `FirebaseFcmSender` reemplazar la constante `CANAL_ANDROID` por `canal.id()` en `setChannelId`. En el adaptador, `notificarOferta` → `OT_NUEVA_TEC`; `notificarCliente` → `OT_UPDATE_CLI`.
- [ ] **Step 5: Correr los mismos tests, luego `.\gradlew.bat test --tests "*notification*"` y `node scripts/check-backend-rules.mjs`.** Esperado: PASS, sin regla que suba. (`.\gradlew.bat build` completo requiere Docker; correrlo si está disponible o reportarlo como no verificado.)
- [ ] **Step 6: Commit sugerido (solo si el usuario lo pide):** `feat(backend): elegir canal de push por rol y evento`

---

### Task 4: App — canales con sonido

**Files:**
- Create: `frontend/android/app/src/main/res/raw/switch_006.ogg`, `switch_007.ogg` (copiar de `Downloads\kenney_interface-sounds\Audio\`).
- Modify: `frontend/projects/mobile/src/app/core/push.ts`, test `frontend/projects/mobile/src/app/core/push.spec.ts`.
- Opcional: `frontend/projects/mobile/src/app/core/` — añadir en un comentario del archivo la atribución "Sonidos: Kenney (CC0)".

**Interfaces:**
- Produces: `export interface CanalPush { readonly id: string; readonly name: string; readonly description: string; readonly sound: string }` y `export const CANALES_PUSH: readonly CanalPush[]` (reemplaza a `CANAL_PUSH`). Mapa: `ot_nueva_tec`→`switch_007.ogg`, `ot_update_tec`→`switch_006.ogg`, `ot_nueva_cli`→`switch_006.ogg`, `ot_update_cli`→`switch_007.ogg`.
- Consumes: ids de Task 3.

- [ ] **Step 1: Test que falla** en `push.spec.ts`, reemplazando la aserción de `CANAL_PUSH`: `expect(CANALES_PUSH.map((c) => c.id)).toEqual(['ot_nueva_tec','ot_update_tec','ot_nueva_cli','ot_update_cli'])` y `expect(new Set(CANALES_PUSH.map((c) => c.sound))).toEqual(new Set(['switch_006.ogg','switch_007.ogg']))`.
- [ ] **Step 2: Correr** `npx ng test mobile --watch=false --include "**/push.spec.ts"` (o `npm run mobile:test`). Esperado: FAIL (no existe `CANALES_PUSH`).
- [ ] **Step 3: Implementar.** En `activar()`, reemplazar el `createChannel` único por un bucle `for (const canal of CANALES_PUSH) await PushNotifications.createChannel({ id, name, description, sound, importance: 5, visibility: 1 })` antes de `register()`. Verificar en `node_modules/@capacitor/push-notifications/dist/esm/definitions.d.ts` que `sound` lleva extensión y busca en `res/raw`. Nombres de los canales en español ("Ofertas nuevas", "Cambios en tu OT", etc.); el id es lo único que importa para el backend. Borrar el uso de `CANAL_PUSH` en todo el repo (Grep).
- [ ] **Step 4: Copiar los dos `.ogg` a `res/raw/`** y comprobar con `Test-Path` que ambos existen (Review Focus 4).
- [ ] **Step 5: Correr `npm run ui:check && npm run mobile:test && npm run mobile:build`** y `npx cap sync android` (confirmar que no falla). Esperado: verde.
- [ ] **Step 6: Commit sugerido (solo si el usuario lo pide):** `feat(mobile): canales de notificacion con sonido propio`

---

### Task 5: Backend — push de presupuesto, aceptación y aprobación

**Files:**
- Create: `backend/src/main/java/…/ot/infrastructure/listeners/OtPushListener.java`
- Modify: `…/ot/domain/services/NotificacionPushPort.java`, `…/ot/infrastructure/notification/FcmNotificacionPushAdapter.java`, `LoggingNotificacionPushAdapter.java`.
- Test: create `backend/src/test/java/…/ot/infrastructure/listeners/OtPushListenerTest.java`; extend `FcmNotificacionPushAdapterTest.java`.

**Interfaces:**
- Produces en `NotificacionPushPort`: `void notificarPresupuestoEnviado(ClienteId clienteId, Ot ot)`, `void notificarOtAceptada(ClienteId clienteId, Ot ot)`, `void notificarPresupuestoAprobado(TecnicoId tecnicoId, Ot ot)`.
- Produces: `OtPushListener(OtRepository otRepository, NotificacionPushPort push)` con `@TransactionalEventListener(phase = AFTER_COMMIT, fallbackExecution = true)` en `void alCambiarEstado(OtEstadoCambiado e)` y `void alAsignar(OtAsignada e)`.
- Consumes: `CanalPush` y `enviar(...)` privado de Task 3; `OtRepository.buscarPorId(OtId) : Optional<Ot>`; `Ot.getClienteId()`, `Ot.getTecnicoId()`.

Textos pinned (tuteo, sin datos personales) y ruta (`ruta` debe pasar `RUTA_PERMITIDA` de `push.ts`; confirmar en `app.routes.ts` que `tecnico/ejecucion/:id` y `cliente/ot/:id/diagnostico` existen):

| Evento | Destino / canal | Título | Cuerpo | `ruta` |
|---|---|---|---|---|
| presupuesto enviado | cliente / `OT_NUEVA_CLI` | "Presupuesto listo" | "El técnico envió el presupuesto de tu orden. Revísalo y apruébalo." | `/cliente/ot/{otId}/diagnostico` |
| OT aceptada | cliente / `OT_NUEVA_CLI` | "Técnico asignado" | "Un técnico aceptó tu orden de {categoría}." | `/cliente/ot/{otId}` |
| presupuesto aprobado | técnico / `OT_UPDATE_TEC` | "Presupuesto aprobado" | "El cliente aprobó el presupuesto. Ya puedes iniciar la reparación." | `/tecnico/ejecucion/{otId}` |

- [ ] **Step 1: Ejecutar `node backend/scripts/check-backend-rules.mjs`** (línea base).
- [ ] **Step 2: Tests del listener que fallan** (`OtPushListenerTest`, mocks de `OtRepository` y `NotificacionPushPort`):
  - `presupuestoEnviadoNotificaAlCliente`: `OtEstadoCambiado(otId, EN_CAMINO, EN_DIAGNOSTICO)` → `verify(push).notificarPresupuestoEnviado(clienteId, ot)`.
  - `presupuestoAprobadoNotificaAlTecnico`: `(EN_DIAGNOSTICO, EN_REPARACION)` con `ot.getTecnicoId()` presente → `verify(push).notificarPresupuestoAprobado(tecnicoId, ot)`.
  - `otAsignadaNotificaAlCliente`: `OtAsignada(otId, tecnicoId, clienteId)` → `verify(push).notificarOtAceptada(clienteId, ot)`.
  - Review Focus 1: `(ASIGNADA, EN_CAMINO)` y `(EN_REPARACION, FINALIZADA)` → `verifyNoInteractions(push)`.
  - Review Focus 2: aprobación con `getTecnicoId()` nulo → `verifyNoInteractions(push)`; `otRepository.buscarPorId` lanzando `IllegalStateException` → el método no lanza y `verifyNoInteractions(push)`.
  En `FcmNotificacionPushAdapterTest` añadir un caso por método nuevo: verifica canal, título, `ruta` y que `cuerpo` no contiene nombre ni dirección (stub de `ot.getCategoriaServicio()`).
- [ ] **Step 3: Correr `.\gradlew.bat test --tests "*OtPushListenerTest" --tests "*FcmNotificacionPushAdapterTest"`.** Esperado: FAIL de compilación.
- [ ] **Step 4: Implementar** los tres métodos del puerto en `FcmNotificacionPushAdapter` (resolver `usuarioId` con `clientes.buscarPorId` / `tecnicos.findByIdAndActivoTrue`, como los métodos existentes) y en `LoggingNotificacionPushAdapter` (solo `log.info`, sin textos personales). El listener carga la OT con `otRepository.buscarPorId`, decide por `(origen, destino)` y envuelve todo en `try/catch (RuntimeException)` con `log.warn` de solo el nombre de la clase (patrón de `FirebaseFcmSender`).
- [ ] **Step 5: Correr los tests del paso 3, luego `.\gradlew.bat test` y `node scripts/check-backend-rules.mjs`.** Esperado: PASS; los tests de `AceptarOfertaUseCaseTest`, `AprobarPresupuestoUseCaseTest` y `RegistrarDiagnosticoUseCaseTest` siguen intactos (no se tocan los casos de uso). Reportar si `build` completo no pudo correrse por falta de Docker.
- [ ] **Step 6: Verificación manual en celular** (no automatizable; reportar como hecha o no hecha): APK nuevo + backend con `FCM_ENABLED=true`; provocar nueva oferta, aceptación, presupuesto enviado y aprobado, y comprobar sonido 007/006 según la tabla del spec.
- [ ] **Step 7: Commit sugerido (solo si el usuario lo pide):** `feat(backend): push de presupuesto, aceptacion y aprobacion de OT`

---

## Self-review

- **Cobertura del spec:** copy (Task 1), identidad e icono de notificación (Task 2), canales/sonidos en backend y app (Tasks 3–4), push nuevos (Task 5). El despliegue conjunto app+backend queda en el spec; no hay tarea de código para él.
- **Cambio respecto al spec:** el enganche de los push usa un listener sobre eventos existentes en vez de modificar los tres casos de uso; el spec lo registra.
- **Consistencia:** `CanalPush`/`enviar(...)` de Task 3 son los que Task 5 consume; los ids de canal son idénticos en Task 3 (`CanalPushTest`) y Task 4 (`push.spec.ts`).
- **Pendiente para quien ejecute:** confirmar las rutas de `app.routes.ts`, las banderas de `@capacitor/assets` y el nombre del proyecto de test (`mobile`).
