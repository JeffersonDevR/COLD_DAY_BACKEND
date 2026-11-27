# Acomodo móvil: Registro, Gestión y Mis OTs — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Registro, Gestión (liquidaciones) y Mis OTs (panel del técnico) se vean ordenados en el teléfono, y listar otras pantallas con los mismos errores.

**Architecture:** Solo HTML/CSS/TS existentes de `frontend/projects/mobile`; sin componentes ni dependencias nuevas. Cada tarea cambia una pantalla con su spec (Vitest) y su CSS, y se verifica con `ui:check`.

**Tech Stack:** Angular 21 + Ionic 9 (standalone, signals, OnPush), CSS por capas en `projects/mobile/src/styles/`, Vitest (`ng test mobile`).

**Spec:** `docs/superpowers/specs/2026-11-24-movil-acomodo-registro-gestion-mis-ots-design.md`

## Global Constraints

- Solo UI móvil. No tocar `backend/`, rutas, endpoints ni dependencias (AGENTS.md regla 3).
- Verificadores: `npm run ui:check` desde `frontend/` antes y después de cada tarea. Prohibido subir techos o editar a mano `frontend/scripts/ui-rules.baseline.json`; se regenera con `--update` solo si bajó (regla 1).
- Prohibido `eslint-disable`, `it.skip`, `@Disabled`, aflojar o borrar tests que no cambien de comportamiento (regla 4). Los tests que se borran o cambian aquí son solo los de «repetir contraseña» y los de copy en voseo, y se explican en el commit.
- Copy en tuteo, español de Colombia (UI-L1); fechas y montos `es-CO`; cifras con `.tnum`/`tabular-nums` (UI-T4).
- Tipografía: piso 12 px (UI-T1), peso máximo 700 (UI-T2), mono solo para datos (UI-T3).
- Campo ≥ 48 px de superficie táctil, target ≥ 44×44, máx. 2 niveles de contenedor, tarjeta que navega = `<a>`/`<button>`.
- No commitear sin que el usuario lo pida (regla 7). Cada tarea termina con un mensaje de commit propuesto: `tipo(ámbito): mensaje` en español.
- Comandos desde `frontend/`. Un solo spec: `npx ng test mobile --watch=false --include <ruta del spec>`; si el builder no acepta `--include`, usa `npm run mobile:test`.
- Antes de empezar, pega la salida de `npm run ui:check` (línea base).

## Review Focus

- Liquidación sin `otCodigo`, `medioPago` o `fechaRegistro` no pinta «undefined» ni «Invalid Date»: «Servicio» y «—» (Tarea 2).
- Liquidación `RECHAZADA` con `motivoRechazo` muestra el motivo dentro de su tarjeta (Tarea 2).
- Pulsar el ojo en Registro no envía el formulario ni llama al backend (Tarea 1).
- Contraseña de 7 caracteres sigue bloqueando el alta tras quitar el campo de confirmación (Tarea 1).
- Panel de técnico sin datos cargados (`tecnico()` nulo) no pinta «undefined» ni subtítulo (Tarea 3).
- Fuente del sistema al 130–150 %: ningún campo ni chip desborda a 360 px (verificación manual, Tarea 5).

---

### Task 1: Registro compacto, ojo dentro del campo, tuteo

**Files:**
- Modify: `frontend/projects/mobile/src/app/pages/registro/registro.page.ts` (template, validadores, tipos, copy)
- Modify: `frontend/projects/mobile/src/app/pages/registro/registro.page.spec.ts`
- Modify: `frontend/projects/mobile/src/styles/pantallas.css` (`.cd-form .label-text` ~L2865; `.cd-auth__ojo` se conserva porque el login lo usa)
- Modify: `frontend/projects/mobile/src/styles/componentes.css` (`.cd-legal::part(label)` ~L286)
- Modify: `DESIGN.md` §5 fila «Campo» (regla del ojo, con su justificación)

**Interfaces:**
- Consumes: `RegistroPage` (`registroForm`, `verPassword`, `alternarPassword()`, `enviar()`, `cambiarRol()`), `data-testid`: `nombre`, `correo`, `telefono`, `password`, `toggle-password`, `habeas`, `crear-cuenta`, `ir-login`.
- Produces: `registroForm.controls` sin `confirmacion`; `CampoRegistro = 'nombre' | 'correo' | 'telefono' | 'password'`; sin `data-testid` `confirmacion` ni `error-confirmacion`.

- [ ] **Step 1: Ajustar el spec (tests que fallan)** en `registro.page.spec.ts`:
  - Quitar `confirmacion` de `base` y de `llenarCliente({ password: 'abc1234', confirmacion: 'abc1234' })`; borrar el test «contraseñas distintas bloquean el alta y se explican».
  - Añadir `it('no pide repetir la contraseña')`: `campo(fixture,'confirmacion')` es `null` y `'confirmacion' in page.registroForm.controls` es `false`.
  - Reescribir el test del toggle como `it('el ojo vive dentro del campo de contraseña y cambia su tipo')`: `campo(fixture,'toggle-password')!.closest('ion-item')` es el mismo nodo que `campo(fixture,'password')!.closest('ion-item')`; `aria-label` contiene «Mostrar», tras `click()` + `detectChanges()` contiene «Ocultar» y `page.verPassword()` es `true`.
  - Añadir `it('el ojo no envía el formulario')`: `click()` en `toggle-password` y `clientesApi.registrarCliente` no fue llamado.
  - Añadir `it('el copy del registro está en tuteo')`: tras `page.enviar()` con form vacío y `detectChanges()`, `fixture.nativeElement.textContent` no coincide con `/\b(Ingresá|Elegí|Repetí|Debés|Creá|tenés)\b/` y `error-nombre` contiene «Ingresa tu nombre completo».
  - Cambiar la expectativa existente `'Ingresá tu nombre'` → `'Ingresa tu nombre'`.
  - `it('exige contraseña de 8 caracteres…')`: sigue pasando con 7 caracteres sin llamar al backend (cubre Review Focus).

- [ ] **Step 2: Correr el spec y ver que falla**
  Run: `npx ng test mobile --watch=false --include projects/mobile/src/app/pages/registro/registro.page.spec.ts`
  Expected: FAIL en los tests nuevos/cambiados.

- [ ] **Step 3: Implementar en `registro.page.ts`:**
  - Quitar el campo `confirmacion` (control, `ion-item`, `contrasenasDistintas`, entrada de `REQUERIDO`, de `FormularioAlta`, de `CampoRegistro`, el `valueChanges` de `password` del constructor y su `takeUntilDestroyed` si queda sin uso).
  - Mover `ion-button.cd-auth__ojo` dentro del `ion-item` de contraseña con `slot="end"`, `fill="clear"`, `type="button"`, `data-testid="toggle-password"`, `aria-label` «Mostrar contraseña»/«Ocultar contraseña»; copiar el marcado de `login.page.ts` L87-L96.
  - Etiquetas: «Nombre completo», «Correo», «Teléfono», «Contraseña (mínimo 8)».
  - Cabecera: borrar `div.cd-auth__ops` y `header.cd-auth__brand`; queda la barra con «Crear cuenta».
  - Texto legal: «Autorizo el tratamiento de mis datos personales según la Ley 1581 de 2012 (Habeas Data).» (marcar en el commit que lo legal debe validarlo quien corresponda).
  - Copy a tuteo: «Ingresa tu nombre completo.», «Ingresa tu correo.», «Ingresa tu teléfono.», «Elige una contraseña.», «Usa al menos 3 caracteres.», «Debes aceptar el tratamiento de datos para continuar.», «¿Ya tienes cuenta? Ingresa».

- [ ] **Step 4: CSS.** En `pantallas.css`, `.cd-form .label-text`: `font-family: var(--cd-font-body)`, `font-size: 0.75rem`, `font-weight: 600`, `text-transform: none`, mismo color. Esto aplica a todo `.cd-form` (cuenta, perfil, calificar): es corregir el CSS para cumplir UI-T3, no cambiar la regla. En `componentes.css`, `.cd-legal::part(label)`: añadir `white-space: normal; text-overflow: clip;` para que el texto no se corte con «…».

- [ ] **Step 5: DESIGN.md §5, fila «Campo»:** añadir «El control que revela o limpia el valor (ojo de contraseña) va dentro del campo, en `slot="end"`, nunca como botón suelto. *Justificación 2026-11-24: Registro lo dejó suelto y quedaba lejos de su campo; el login ya lo hacía bien.*»

- [ ] **Step 6: Correr el spec y `ui:check`**
  Run: el comando del Step 2, luego `npm run ui:check`
  Expected: spec PASS; `ui:check` sin reglas que suban (el techo de voseo debe bajar o quedar igual).

- [ ] **Step 7: Medir en navegador.** `docker compose up -d db`, `cd backend && .\gradlew.bat bootRun`, `npm start` (4200); abrir `/registro` con `mcp__Claude_Browser__*` a 360×640 (`resize_window` 360×640). Con `javascript_tool` medir: cada `ion-item` del form ≤ 64 px de alto y el botón «Crear cuenta» con `getBoundingClientRect().bottom` ≤ 640. Reportar los valores medidos; si no se cumple, decir cuánto falta, sin aflojar la meta en silencio.

- [ ] **Step 8: Proponer commit** (sin ejecutarlo): `feat(mobile): registro sin repetir contraseña, ojo dentro del campo y copy en tuteo`

---

### Task 2: Gestión — una tarjeta por liquidación

**Files:**
- Modify: `frontend/projects/mobile/src/app/pages/liquidaciones-tecnico/liquidaciones-tecnico.page.html` (artículos de liquidación y de documento)
- Modify: `frontend/projects/mobile/src/app/pages/liquidaciones-tecnico/liquidaciones-tecnico.page.spec.ts`
- Modify: `frontend/projects/mobile/src/styles/pantallas.css` (nuevo bloque `.cd-liq*` junto a `.cd-liquidacion` ~L2443)
- Modify: `DESIGN.md` §5 (regla de tarjeta de lista)

**Interfaces:**
- Consumes: `LiquidacionesTecnicoPage` (`liquidaciones()`, `fecha()`, `cop()`, `etiquetaMedio()`, `etiquetaEstado()`, `tonoEstado()`, `documentos()`), `data-testid`: `liquidacion-<id>`, `estado-<id>`, `motivo-<id>`, `documento-<id>`.
- Produces: cada elemento es `article.cd-card.cd-liq` con `data-testid` `comision-<id>` (monto) y `meta-<id>` (fecha · medio); clases `cd-liq__cabecera`, `cd-liq__monto`, `cd-liq__etiqueta`, `cd-liq__meta`.

- [ ] **Step 1: Tests en el spec (fallan).** Con tres liquidaciones de prueba (reutiliza el fixture del spec): 
  - `it('cada liquidación es su propia tarjeta')`: cada `[data-testid^="liquidacion-"]` tiene clases `cd-card` y `cd-liq`, y no comparten contenedor interno entre sí (`article` hermanos).
  - `it('la comisión es el dato principal')`: `comision-<id>` contiene `$ 22.500` y el `meta-<id>` contiene la fecha y el medio.
  - `it('la fecha no usa la clase que capitaliza')`: `meta-<id>` tiene `cd-liq__meta` y NO tiene `cd-ot__categoria` (esa clase pone «De» en mayúscula por `text-transform: capitalize`).
  - `it('una liquidación sin datos opcionales no pinta undefined')`: `otCodigo`, `medioPago` y `fechaRegistro` ausentes → el texto de la tarjeta contiene «Servicio» y «—» y no `undefined` ni `Invalid Date`.
  - `it('el motivo de rechazo vive dentro de su tarjeta')`: liquidación `RECHAZADA` con `motivoRechazo` → `motivo-<id>.closest('article')` es `liquidacion-<id>`.
  - `it('cada documento es su propia tarjeta')`: `documento-<id>` tiene `cd-card`.

- [ ] **Step 2: Correr y ver fallar**
  Run: `npx ng test mobile --watch=false --include projects/mobile/src/app/pages/liquidaciones-tecnico/liquidaciones-tecnico.page.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Implementar el HTML.** Cada liquidación: `<article class="cd-card cd-liq">` con `cd-liq__cabecera` (código mono `liq.otCodigo ?? 'Servicio'` + chip de estado), `p.cd-liq__etiqueta` «Comisión a transferir», `p.cd-liq__monto.tnum` con `$ {{ cop(liq.comision) }} COP`, `p.cd-liq__meta` con `{{ fecha(liq.fechaRegistro) }} · {{ etiquetaMedio(liq.medioPago) }}` y `Servicio total: $ {{ cop(liq.montoServicio) }} COP`, y el motivo de rechazo al final. Los documentos usan `<article class="cd-card cd-liq">` con el mismo patrón de cabecera.

- [ ] **Step 4: CSS.** `.cd-liq { margin: 0 0 0.75rem; }` (el fondo, borde y radio vienen de `.cd-card`); `.cd-liq__cabecera` flex entre código y chip con `gap`; `.cd-liq__etiqueta` 12 px muted; `.cd-liq__monto` `var(--cd-font-head)` 1.25rem peso 700; `.cd-liq__meta` 12 px muted sin `text-transform`. Usa tokens existentes, sin colores nuevos.

- [ ] **Step 5: DESIGN.md §5, fila «Tarjeta»:** añadir «Cada elemento repetido de una lista de datos (liquidación, documento) es una tarjeta con fondo y borde propios. *Justificación 2026-11-24: en Gestión `article.cd-ot` no tenía fondo ni borde y no se distinguía dónde acababa una liquidación y empezaba otra.*»

- [ ] **Step 6: Correr spec y `ui:check`** (como en Task 1). Expected: PASS y sin reglas que suban.

- [ ] **Step 7: Medir en navegador.** `/gestion` como `tecnico1@coldday.com.co` (seeder, 10 liquidaciones aprobadas): `javascript_tool` confirma que cada `[data-testid^="liquidacion-"]` tiene `background-color` distinto de `rgba(0, 0, 0, 0)` y `border-top-width` ≥ 1 px; captura de pantalla.

- [ ] **Step 8: Proponer commit:** `feat(mobile): gestion con una tarjeta por liquidacion y fecha sin mayusculas`

---

### Task 3: Mis OTs — estado sin repeticiones

**Files:**
- Modify: `frontend/projects/mobile/src/app/pages/panel-tecnico/panel-tecnico.page.html` (L1-L5, L49-L51, L72-L96)
- Modify: `frontend/projects/mobile/src/app/pages/panel-tecnico/panel-tecnico.page.spec.ts`
- Modify: `frontend/projects/mobile/src/styles/pantallas.css` (`.cd-estado__chips` ~L2036)
- Modify: `docs/superpowers/specs/2026-11-24-movil-acomodo-registro-gestion-mis-ots-design.md` (solo si la implementación se aparta de él)

**Interfaces:**
- Consumes: `PanelTecnicoPage` (`tecnico()`, `radarVisible()`, `modoUbicacion()`, `cambiarDisponibilidad()`), `data-testid`: `switch-ubicacion`, `disp-*`, `bloqueado-liquidacion`, `validacion-pendiente`, `validacion-rechazada`, `tecnico-nombre`.
- Produces: sin `data-testid="radar-visible"`; sin binding `[subtitulo]` en `<cd-page>`; sin la nota fija «Bloqueada con una OT en curso.».

- [ ] **Step 1: Tests (fallan)** en `panel-tecnico.page.spec.ts` (reutiliza `setup()` y `texto()`):
  - `it('no repite que la cuenta está habilitada')`: con técnico `APROBADO`, `texto(fixture)` no contiene «para recibir órdenes».
  - `it('con la cuenta pendiente solo habla la alerta, no el subtítulo')`: técnico no aprobado → existe `validacion-pendiente` y el texto no contiene «todavía no está habilitada para recibir».
  - `it('la visibilidad no es un chip aparte')`: con `presencia` reportando y técnico `APROBADO`/`DISPONIBLE` (`radarVisible()` verdadero), `campo radar-visible` es `null` y «Visible en el radar» no aparece como chip.
  - `it('no muestra la nota fija de bloqueo')`: el texto no contiene «Bloqueada con una OT en curso».
  - `it('sin técnico cargado no pinta undefined ni subtítulo')`: `tecnico()` nulo → título «Tu panel de técnico», texto sin `undefined`.
  - Los tests existentes (409 de disponibilidad, título de ubicación) deben seguir pasando sin cambios.

- [ ] **Step 2: Correr y ver fallar**
  Run: `npx ng test mobile --watch=false --include projects/mobile/src/app/pages/panel-tecnico/panel-tecnico.page.spec.ts`
  Expected: FAIL en los tests nuevos.

- [ ] **Step 3: Implementar el HTML.** Quitar el atributo `[subtitulo]` de `<cd-page>` (el aviso de cuenta no habilitada ya vive en las alertas `validacion-rechazada`/`validacion-pendiente`); borrar el `<span … data-testid="radar-visible">`; borrar `<p class="cd-ayuda">Bloqueada con una OT en curso.</p>`. Los tres textos del modo de ubicación se quedan igual. No tocar la lógica de `radarVisible()` en el `.ts` (queda disponible para otras pantallas; si queda sin uso, déjalo y no lo borres: cambio mínimo).

- [ ] **Step 4: CSS.** `.cd-estado__chips` pasa a `display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem;` y `.cd-estado__chips .cd-chip` a `justify-content: center; padding-inline: 0.5rem;` (conserva `min-height: 44px`; `minmax(0,1fr)` evita el desborde de DESIGN §8.5).

- [ ] **Step 5: Correr spec y `ui:check`.** Expected: PASS y sin reglas que suban.

- [ ] **Step 6: Medir en navegador.** `/tecnico` (Mis OTs) como `tecnico1`, a 360 px: los tres chips `disp-*` miden el mismo ancho (±1 px) y no desbordan el contenedor `.cd-estado`; captura de pantalla.

- [ ] **Step 7: Proponer commit:** `feat(mobile): mis ots sin subtitulo ni chip repetidos y disponibilidad en tres columnas`

---

### Task 4: Revisión de otras pantallas (solo lista, sin cambios)

**Files:**
- Read: `frontend/projects/mobile/src/app/pages/{documentos-proveedor,solicitudes-proveedor,ejecucion-ot,cuenta,perfil-tecnico,ofertas-tecnico,calificar,solicitar-servicio,panel-cliente}/`
- Create: nada. El resultado se entrega en el chat.

**Interfaces:** Consumes: las reglas nuevas de §5 (ojo dentro del campo; elementos de lista = tarjeta) y UI-T3/UI-L1/UI-X6. Produces: lista de hallazgos.

- [ ] **Step 1: Buscar los antipatrones** con Grep/lectura, uno por uno: `article.cd-ot` o `cd-ot` sin `cd-card` (lista sin tarjeta); botones de icono fuera de su `ion-item` en formularios; `.label-text`/mono en mayúsculas en `.cd-form`; textos de ayuda fijos que no dependen del estado; el mismo dato mostrado en dos lugares (chip de header + cuerpo); voseo (`Ingresá|Elegí|Debés|tenés|Creá|Pedí`); campos de formulario con más de 64 px.
- [ ] **Step 2: Entregar la lista** por pantalla: archivo:línea, qué antipatrón, arreglo propuesto, riesgo. No editar nada; el dueño decide cuáles pasan a tarea.

---

### Task 5: Verificación final

**Files:** ninguno nuevo.

- [ ] **Step 1: Verificadores completos.** `npm run ui:check`, `npm run mobile:test`, `npm run mobile:build`. Expected: todo en verde; pegar la salida. Si una regla «SUBIÓ», corregir el código, no el baseline.
- [ ] **Step 2: Escala de fuente.** En el navegador, a 360 px con `document.documentElement.style.fontSize='150%'`, revisar Registro, Gestión y Mis OTs: sin scroll horizontal (`document.scrollingElement.scrollWidth <= innerWidth`) y chips y campos sin recortar. Restaurar al terminar.
- [ ] **Step 3: Restaurar el entorno.** `frontend/.env` → `MOBILE_API_ORIGIN` sin cambios (no se tocó); detener el servidor y `docker compose` si los arrancaste.
- [ ] **Step 4: Entregar** en el formato de AGENTS.md: archivos cambiados, salida de comandos, checklist de la Definición de hecho de `DESIGN.md` §11 marcado y lo que no pudiste verificar (p. ej. dispositivo real, validación legal del texto).
