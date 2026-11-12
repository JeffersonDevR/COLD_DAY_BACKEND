# DESIGN.md — COLD DAY · Cold Dispatch / Dark Ops

**Fuente única del diseño.** Reemplaza y fusiona los antiguos `DESIGN.md` (web), `docs/design/dark-ops/DESIGN.md` (móvil), `flujo-solicitud/README.md`, `plan-ui.md` y `auditoria-ui.md`. Los originales están intactos en `docs/design/_archivo/` solo como historia: **no los uses como referencia**.

> **Si eres un modelo/agente:** este archivo es ley, no sugerencia. Las reglas con ID `UI-xx` se verifican con comandos; las que no tienen comprobación automática igual se revisan en §11 (Definición de hecho). Una tarea de UI **no está terminada** hasta cumplir §11. No hay excepciones "por tiempo". Si una regla te parece incorrecta, **detente y pregunta**; no la rodees.

---

## 0. Protocolo obligatorio (en este orden)

1. Lee este archivo completo. Lee `PRODUCT.md` (voz y principios) si tocas texto.
2. Corre `cd frontend && npm run ui:check` **antes** de empezar. Anota el resultado.
3. Haz el cambio mínimo que cumpla la tarea. Reutiliza lo que ya existe (§5, §8).
4. Corre `npm run ui:check` **después**. Si alguna regla "SUBIÓ", corrige el código. **Prohibido** subir techos o editar `frontend/scripts/ui-rules.baseline.json` a mano.
5. Corre `npm run mobile:test` (o `ng test` si tocaste la web). No cambies un test para que pase salvo que el texto/estructura cambie por la tarea; explica por qué.
6. Verifica en pantalla real o emulada a **320, 360, 390, 430 y 768 px** (§10).
7. Entrega con el checklist de §11 marcado, uno por uno, con la evidencia (comando + resultado).

**Prohibido para el agente:** desactivar reglas, añadir `// eslint-disable`/`/* ui-ignore */`, usar `--no-verify`, borrar tests, bajar umbrales de cobertura, o declarar "hecho" sin ejecutar §11.

---

## 1. Producto y alcance

- Mercado: Colombia (Cúcuta y área metropolitana). Voz: **tuteo**, directa, cálida, operativa. Ver `PRODUCT.md`.
- Dos superficies con el **mismo mundo visual** y dos perfiles de medidas (§2.4):
  - **Móvil** (`frontend/projects/mobile`, Ionic 9 + Angular 21 + Capacitor 8): cliente, técnico, proveedor. Referencia 390 px.
  - **Web consola** (`frontend/src`, Angular 21 + Tailwind v4 + PrimeNG): administrador/contable, y flujos pesados.
- Fuera del sistema: `landing/` (mundo claro, tienda).
- Plataforma de verdad: tema oscuro **único**. No existe modo claro.

Principios (resumen de `PRODUCT.md`): el registro es la verdad · estados honestos (nunca progreso falso) · el técnico es usuario, no recurso · el dinero nunca es ambiguo (siempre desglosado) · una identidad, varios roles.

---

## 2. Tokens

### 2.1 Superficies y texto (compartido)

| Token móvil | Valor | Uso | Web (nombre en este doc) |
|---|---|---|---|
| `--cd-canvas` | `#0b1220` | fondo de pantalla | canvas |
| `--cd-surface` | `#111b2e` | tarjetas, barras | surface |
| `--cd-surface-2` | `#16223b` | hover, fila elevada | surface-elevated (`#16243a`) |
| (pozo) | `#0e1828` | inputs y bloques hundidos | surface-well |
| `--cd-line` | `#1e293b` | borde por defecto | border |
| `--cd-line-strong` | `#334155` | borde que debe verse | border-strong |
| `--cd-text-1` | `#f8fafc` | solo títulos | text-primary |
| `--cd-text-2` | `#e2e8f0` | texto base | text-body |
| `--cd-text-3` | `#cbd5e1` | etiquetas, metadatos | text-label |
| `--cd-text-4` | `#94a3b8` | ayuda, hora, placeholder (**mínimo permitido**) | text-secondary |

### 2.2 Roles de color — un rol, un significado

| Rol | Valor | Significa | NO significa |
|---|---|---|---|
| action `--cd-action` | `#22d3ee` (hover `#06b6d4`) | **se toca** / acción principal / en curso | info, precio, decoración |
| success | `#22c55e` (tinta `#6ee7b7`) | completado, aprobado | disponible, en línea |
| warn | `#f59e0b` (tinta `#fcd34d`) | dinero, plazo, esperando decisión | selección |
| parts | `#a78bfa` (tinta `#c4b5fd`) | repuesto, insumo, disputa | estado general |
| danger | `#f87171` (tinta `#fca5a5`) | error, rechazo | acción destructiva secundaria |

- **UI-C2 — Regla de la señal:** cian cubre ≤10 % de una pantalla. Si dos cosas son cian y una no se toca, esa es decoración y pierde el cian. Etiquetas ("PANEL DEL CLIENTE"), iconos informativos y títulos de tarjeta **no** son cian.
- **UI-C1 — Gris prohibido:** `#64748b` y `#475569` (y `text-slate-500/600`) nunca llevan texto sobre canvas/surface/pozo. Usa `--cd-text-4` o más claro. *(Automático.)*
- **UI-C3 — Estado = tinta sobre tinte,** nunca relleno sólido. Excepción: botones de acción semánticos (aprobar/rechazar) rellenan con tono 700 y tinta blanca.
- **UI-C4 — Nunca solo color:** todo estado lleva texto. Prohibido un punto de color sin etiqueta.
- **UI-C5 — Hex:** ningún color literal nuevo fuera de las declaraciones de token. `scripts/check-styles.mjs` vigila el techo (hoy 63, solo baja). Usa `var(--cd-*)`.

### 2.3 Profundidad y forma

- Plano por defecto: profundidad = escalón tonal + borde de 1 px. **UI-D1** sin `backdrop-filter`/`backdrop-blur` decorativo; **UI-D2** sin halos de offset cero; **UI-D3** sin gradientes; **UI-D4** sin variante `dark:` (web). *(Automáticas.)*
- Solo existen 3 sombras: *Accent Glow* (CTA primario), *Accent Halo* (marca / pin en vivo), *Overlay* (modal/popover). Nada más.
- Bordes: 1 px `--cd-line`; `--cd-line-strong` si debe verse. Punteado solo para ausencia (vacío, hueco).

### 2.4 Medidas por perfil

| Medida | Móvil (Ionic) | Web consola |
|---|---|---|
| Radio tarjeta | 16 px (`--cd-radius`) | 12 px |
| Radio intermedio / control | 12 / 8 px | — / 8 px |
| Overlay / modal | 16 px | 16 px |
| Pastilla | 999 px | 999 px |
| Badge | — | 4 px |
| Botón primario | **mín. 48 px, objetivo 52 px** | 40 px (36 compacto) |
| Campo de formulario | 48 px | 40 px |
| Tab bar | mín. 56 px (64 en diseño) | — |
| AppBar | mín. 56 px | topbar 64 px |
| Target táctil | **mín. 44×44** (24×24 absoluto) | 32 px densidad, 40 por defecto |
| Gutter de pantalla | **16 px** (§8, UI-X1) | 16/24/32 por breakpoint |
| Ancho máx. contenido | fluido 360–430, tope 430 centrado (`--cd-shell-max`) | contenedor 1600 px |
| Escala de espacio | 4·8·12·16·24·32·48 | igual |

---

## 3. Tipografía

| Rol | Familia | Tamaño | Peso | Notas |
|---|---|---|---|---|
| Título de pantalla | Space Grotesk | 20–22 (web 32) | 700 | uno por pantalla |
| Título de tarjeta | Space Grotesk, **frase** | 15–16 | 700 | **no** mono, **no** mayúsculas |
| Cuerpo | Inter | 14–15 | 400 | largo máx. 70ch |
| Etiqueta / overline | Inter | 12 | 600 | tracking .06em; mayúsculas solo ≤24 car. |
| Dato máquina | Space Mono | 12 | 500 | ID, monto, hora, coordenadas, matrícula |

- **UI-T1 — Piso de 12 px.** Nada por debajo, incluidas micro-etiquetas y ejes de gráficos. Si no cabe, el texto es demasiado largo. *(Automática.)*
- **UI-T2 — Techo de 700.** Prohibidos `font-black`, `font-extrabold`, 800, 900. *(Automática.)*
- **UI-T3 — Mono = dato.** Nunca para frases, botones, navegación ni **títulos de tarjeta/sección** (hoy hay títulos mono en mayúsculas con tracking ancho: migrarlos a Space Grotesk en frase). Única excepción: overline de 2–3 palabras.
- **UI-T4 — Cifras tabulares** (`.tnum` / `tabular-nums`) en todo monto, contador y hora.
- **UI-T5 — Prohibido** eyebrow/overline sobre el título de pantalla ("PANEL DEL CLIENTE" encima de "Hola, María"). El título se sostiene solo.
- Fuentes: solo Space Grotesk, Inter, Space Mono. **Public Sans está retirada** (quítala donde aparezca). Auto-hospedadas en producción, 2 familias × ≤2 pesos de texto, sin `<link>` duplicado.

---

## 4. Layout y comportamiento

- **UI-X2 — Marco móvil fluido:** 360–430 px llenan el ancho; por encima, la app queda centrada con tope 430 px (`ion-app` en `@media (min-width:431px)`). Nada de anchos fijos en `px` para contenido; usa `%`, `rem`, `clamp()`, `dvh`.
- **UI-S1 — Safe-area unificada:** solo `var(--cd-safe-top)` / `var(--cd-safe-bottom)` (definidos en `:root`). Prohibido `env(safe-area-inset-*)` suelto con fallback propio. *(Automática.)*
- **UI-X3 — Alturas fluidas:** mapa `clamp(200px,32dvh,320px)`, firma `clamp(120px,20dvh,180px)`. Prohibido `height` fijo en contenido que escala; `min-height` sí.
- **UI-X4 — Banner sin conexión** nunca tapa el header: usa `ion-app:has(> .cd-offline)` (ya implementado). No lo reemplaces por `position:fixed` sobre el contenido.
- **UI-X5 — Teclado virtual:** con un campo enfocado, el CTA fijo no puede tapar el campo. Probar en dispositivo real (pendiente: plugin Keyboard de Capacitor).
- **Una acción primaria rellena por pantalla**; el resto ghost/outline. Excepción: colas de trabajo donde cada fila tiene su acción (`solicitudes-proveedor`, `panel-tecnico`).
- **Máx. 2 niveles de contenedor** (tarjeta › fila). Prohibido tarjeta dentro de tarjeta.
- **Si una tarjeta navega, es `<a>` o `<button>`.** **UI-A3** (automática): nada de `div/article/li` con `(click)`.
- **Tres KPI de colores como estructura de página** (hero-metric): prohibido.
- **Composición por rol:** cliente = una OT activa grande + historial colapsado · técnico = cola *ahora / próximo / después* (distancia, ventana horaria; la urgencia manda, el dinero es secundario) · proveedor = bandeja con plazo visible (la facturación es dato de contexto).
- **Un botón, una ruta.** No dupliques el mismo destino con dos controles en la misma pantalla (ej.: "Mis liquidaciones" apareció como tarjeta y como botón).

---

## 5. Componentes (ninguna pantalla inventa uno nuevo sin pedirlo)

| Componente | Clase / archivo | Regla |
|---|---|---|
| AppBar / header | `.cd-header` | sticky, ≥56 px, safe-area arriba |
| Footer con CTA | `.cd-footer` | fijo, zona del pulgar, safe-area abajo, helper 12 px encima |
| Tab bar | `ion-tab-bar.cd-tab-bar` | ≥44 px por tab, etiqueta en frase 12 px, `aria-current` |
| Tarjeta | `.cd-card` | padding 16; ver trampas de Ionic (§8) |
| Píldora de estado | `.cd-chip`, `status-badge` | 12 px, tinta sobre tinte, texto siempre |
| CTA | `.cd-cta` | ≥48 px (obj. 52), frase, nunca mayúsculas |
| Campo | `.cd-form ion-item` | etiqueta visible, ≥48 px, error con `aria-describedby` |
| Vacío / carga / error | `shared/ui`: `empty-state`, `skeleton`, `loading`, `error-alert` | **obligatorios** en toda lista (UI-X6) |
| Timeline | `shared/ui/service-timeline` | nodos con etiqueta |
| Modal | `.cd-modal*` | foco atrapado, Escape cierra |

**Pendiente de crear (ver `docs/design/TAREAS-UI.md`):** un único `<cd-page>` (header + contenido + footer) para que los 34 headers y 14 footers escritos a mano dejen de divergir; y partir `styles.css` por capas.

### Estados (UI-X6)
Toda pantalla con datos remotos implementa los 8 estados: default, hover, `focus-visible`, active, disabled (`opacity .4`), **cargando** (skeleton o spinner 20 px + "Procesando…", bloqueo de doble envío), **vacío** (una línea + una acción) y **error** (qué falló + reintentar al lado). Hoy faltan cargas en la mayoría: es deuda registrada (TU-04).

---

## 6. Accesibilidad — piso no negociable (WCAG 2.1 AA)

| Regla | Detalle |
|---|---|
| **UI-A1** zoom | `viewport` sin `user-scalable=no` ni `maximum-scale=1` *(automática)* |
| **UI-A2** foco | outline 2 px cian, offset 2 px, en todo lo tocable. Prohibido `outline:none` sin reemplazo *(automática)* |
| Targets | ≥44×44 (§2.4) |
| Iconos | decorativos `aria-hidden="true"`; solo-icono → `aria-label` en el control |
| Estado | `aria-pressed` en toggles, `role="switch"`+`aria-checked`, `aria-live="polite"` en contadores/vencimientos, `aria-busy` en acciones asíncronas |
| Errores | `role="alert"` + `aria-describedby` + `aria-invalid` |
| Imágenes | `alt` real |
| Movimiento | `prefers-reduced-motion` respetado; un solo indicador "live" por pantalla |
| Texto del sistema | debe seguir usable con la fuente del teléfono al 130–150 % (probar; evitar `nowrap` sobre texto de usuario) |
| Contraste | texto normal ≥4.5:1; `scripts/auditar-contraste.mjs` |

---

## 7. Copy y localización

- **UI-L1 — Tuteo, no voseo.** El producto habla de "tú" (`tienes`, `puedes`, `elige`, `crea`). `PRODUCT.md` lo fija. El código móvil actual está en voseo ("tenés", "pedí"): es **deuda** (techo en baseline, hoy 40 mobile/19 web). Todo texto **nuevo** va en tuteo. Migrar una pantalla = cambiar copy **y** su spec en el mismo commit. *(Automática.)*
- **UI-L2 — Mercado Colombia.** Cero términos argentinos: heladera→nevera, lavarropas→lavadora, service→mantenimiento, CUIT→NIT, AFIP→DIAN, CBU/CVU→cuenta bancaria, `.com.ar`/`+54`→`.co`/`+57`, Mercado Pago→Nequi/Daviplata. *(Automática; hoy 0.)*
- Formatos `es-CO`: `$1.240.000 COP`, `1,4 km`, hora `10:30`, fechas `es-CO`.
- Los `tel:` y los dominios de correo son lo más caro: marcan a otro país y no se ven en una revisión visual.
- **No inventes** precios, SLA de llegada, política de reembolso, testimonios, calificaciones no calculadas ni métricas (ver "Absences" en `PRODUCT.md`).
- Vocabulario fijo: OT, consignación, liquidación, acta, dictamen, comisión de plataforma, proveedor auxiliar, garantía (90 días).
- Errores: nombran qué falló y qué hacer; nunca el mensaje crudo del backend (`mensajeErrorAccion`).

---

## 8. Trampas de Ionic en este proyecto (aprendidas midiendo; **no las repitas**)

1. **`css/padding.css` de Ionic NO está en el build móvil.** `class="ion-padding"` solo funciona porque `styles.css` define `ion-content.ion-padding {--padding-*: 1rem}`. No quites esa regla. No uses otras utilidades `ion-*` (`ion-margin`, `ion-text-center`…) sin verificar que existan.
2. **`<ion-card>` trae `margin:10px`** y su `ion-card-content` trae `padding:16px`. Aquí: `ion-card.cd-card {margin:0 0 .75rem; padding:1rem}` y `ion-card.cd-card > ion-card-content {padding:0}`. Si añades una tarjeta nueva, usa esas clases; no sumes padding encima.
3. **`<section class="cd-card">`** no tiene margen: hermanas se pegan → ya existe `section.cd-card + section.cd-card {margin-top:.75rem}`.
4. **`ion-button` aplica `text-transform:uppercase` y fuente mono.** Para texto en frase dentro de un `ion-button`/tarjeta-botón, fija `text-transform:none` y la familia explícitamente.
5. **Grid + `nowrap` + `min-width:auto` desborda:** si un hijo de `display:grid` lleva `white-space:nowrap`, la pista crece al ancho del texto y tapa a su vecino. Usa `grid-template-columns: minmax(0,1fr)` o permite `normal`.
6. **`ion-col` tiene 5 px de padding;** una `ion-row` dentro de un contenedor con gutter necesita `margin-inline:-5px` para alinear con el resto.
7. **`ion-segment` desborda a propósito** (scroll horizontal). Si lo haces, añade señal visual de que se desliza (degradado en el borde cuando hay más contenido).
8. **`hyphens:auto` parte palabras** de forma fea ("acondicio-nado"). No lo uses en títulos; gana ancho (ocultar flecha ≤380 px) en vez de partir.
9. **`:has()`** se usa en el banner offline; es válido en Chromium/WebView modernos. No lo copies para lógica crítica sin probar en el WebView objetivo.
10. **Variables CSS duplicadas:** una misma `--cd-*` declarada dos veces gana la última en silencio. `check-styles.mjs` lo prohíbe. Para variantes usa un multiplicador (ver `--cd-safe-on`), no una redeclaración.
11. **jsdom** imprime "Could not parse CSS stylesheet" por el CSS de Ionic: es ruido conocido, no un fallo.
12. **Datos de prueba:** el seeder no crea OTs en curso ni ofertas; para ver esas pantallas hay que sembrarlas (ver `docs/design/TAREAS-UI.md` TU-08).

---

## 9. Rendimiento

- Tailwind **compilado** en la web, nunca CDN. Imágenes locales con `width/height` y `loading="lazy"`.
- Fuentes: precargar solo Inter y Space Grotesk; `font-display: swap`.
- Un solo indicador animado "live". Todas las animaciones tienen equivalente estático.

---

## 10. Verificación

| Qué | Comando (desde `frontend/`) | Falla si |
|---|---|---|
| Reglas de diseño (techos que solo bajan) | `npm run ui:check` | alguna regla SUBIÓ |
| Tokens y hex | `node scripts/check-styles.mjs` (incluido en `ui:check`) | token duplicado/roto, hex > techo |
| Contraste | `node scripts/auditar-contraste.mjs` | par bajo AA |
| Tests móvil | `npm run mobile:test` | algún spec falla |
| Build móvil | `npm run mobile:build` | no compila |
| Render por tamaño | `node scripts/ui-audit.mjs` (Playwright, ver cabecera) | desborde, <12 px, target <44, texto recortado, pestaña cortada en 320/360/390/430/768 |

Reglas del verificador: `frontend/scripts/check-ui-rules.mjs` (IDs `UI-T1…UI-L2`). Baseline: `frontend/scripts/ui-rules.baseline.json` (solo baja con `npm run ui:check -- --update`, y solo si bajó).

**Wiring que no se puede saltar:** `premobile:build` y `premobile:test` ejecutan `ui:check`; el CI (`.github/workflows/frontend-ci.yml`) lo ejecuta en `build-and-test` y `mobile-build`; el hook `.githooks/pre-commit` lo ejecuta antes de cada commit (activar: `git config core.hooksPath .githooks`).

Para ver pantallas con sesión en local: backend en `http://localhost:8090`, `MOBILE_API_ORIGIN=http://localhost:8090` y servir la app en el puerto **4200** (el único permitido por CORS en dev). **Restaura `MOBILE_API_ORIGIN` de producción antes de compilar un APK.** Usuarios sembrados: `cliente1…5`, `tecnico1…5`, `proveedor1`, `admin`, `contable` en `@coldday.com.co`; contraseña en `app.seed.demo-password` (ver `DevDataSeeder`). El login tiene rate limit (10/min por IP): reutiliza sesión, no inicies sesión en bucle.

---

## 11. Definición de hecho (marca cada ítem con evidencia)

- [ ] `npm run ui:check` en verde y **ninguna** regla sube (pega la salida).
- [ ] `npm run mobile:test` en verde (o `ng test`).
- [ ] `npm run mobile:build` compila.
- [ ] 320, 360, 390, 430 y 768 px: sin scroll horizontal, sin texto <12 px, sin target <44 px, sin texto recortado (salida de `ui-audit.mjs` o capturas).
- [ ] Gutter de 16 px; tarjetas alineadas; sin padding doble (§8).
- [ ] Estados cargando / vacío / error presentes si hay datos remotos.
- [ ] Copy nuevo en tuteo, sin términos argentinos; spec actualizado si cambió el texto.
- [ ] Accesibilidad: foco visible, `aria-*` de §6, iconos decorativos `aria-hidden`.
- [ ] Una sola acción primaria rellena; sin tarjeta dentro de tarjeta; sin botón duplicado.
- [ ] No se tocó `backend/` ni `frontend/src` (web) salvo que la tarea lo pida.
- [ ] `MOBILE_API_ORIGIN` restaurado si se cambió; nada de secretos en el commit.

---

## 12. Mapa de pantallas (diseño ↔ código)

Prototipos en `docs/design/dark-ops/<carpeta>/` (`code.html`, a veces `screen.png`). **a5 viejo está superado** por `flujo-solicitud/a5-1..3` (3 pasos; no implementar a5).

| Diseño | Página móvil | Rol |
|---|---|---|
| a1_login · a2_registro | `pages/login`, `pages/registro` | público |
| a3_mi_cuenta_y_cambiar_rol · a3.1 | `pages/cuenta` | todos |
| a4_panel_cliente | `pages/panel-cliente` | cliente |
| a5-1/2/3 (flujo-solicitud) | `pages/solicitar-servicio` | cliente |
| a6_seguimiento_de_ot · a7 · a8 | `pages/seguimiento-ot`, `diagnostico`, `pago-acta` (+ `calificar`) | cliente |
| a10_mis_equipos | `pages/equipos` | cliente |
| b0_panel_tecnico · b2_mis_ots | `pages/panel-tecnico` | técnico |
| b1_radar_de_ofertas | `pages/ofertas-tecnico` | técnico |
| b3_ejecucion_de_ot | `pages/ejecucion-ot` | técnico |
| b4_perfil_tecnico | `pages/perfil-tecnico` | técnico |
| c0/c1 | `pages/solicitudes-proveedor` | proveedor |
| c2_documentos | `pages/documentos-proveedor` | proveedor |

Flujo de solicitud (3 pasos): CTA `Continuar` → `Continuar a revisión` → `Solicitar técnico`; categoría = tarjeta vertical sin truncar con check 24×24 y selección por `ion-radio-group`; descripción con dictado ≥44×48 (Web Speech con fallback a teclado); ubicación = una tarjeta `ion-item button` ≥64 px; sin sección de evidencia fotográfica ni "Próximamente"; hint `Desliza para volver`; CTA fijo 52 px con helper de 12 px encima.

Paridad web↔móvil y qué es solo-web (admin/contable): `docs/mobile-paridad.md` (mantener al agregar pantallas).

---

## 13. Estado conocido (2026-11-12)

- Hecho y medido con Playwright (13 pantallas × 5 anchos, sin desbordes): base global, gutter, tarjetas, fuentes ≥12 px, Mi cuenta, tarjetas de servicio, banner offline.
- Deuda abierta con dueño en `docs/design/TAREAS-UI.md`: `<cd-page>`, partir `styles.css`, estados de carga/vacío/error, migración a tuteo, títulos mono→Grotesk, señal de scroll en filtros, teclado virtual, prueba en Android real, pantallas sin datos de seed, Public Sans, Tailwind CDN en prototipos.
- Historial de decisiones y auditorías anteriores: `docs/design/_archivo/` y `odd/tasks/ui-dark-ops-pass.md`, `odd/tasks/ionic-stitch-fidelity.md`.
