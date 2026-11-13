# Plan de trabajo por oleadas — docs/design/dark-ops

Derivado de [auditoria-ui.md](auditoria-ui.md) (critique 21/40). Orden fijado por vos: **operabilidad → sistema de diseño → lo que falta**. Tono: **registro separado por audiencia** (técnico y proveedor operativos; cliente orientado a la promesa del servicio). Alcance: **todo el set, en oleadas**.

Cada ola termina en un criterio de aceptación verificable. Si una ola no cumple, no arranca la siguiente: el punto del orden es no construir el sistema sobre una base inaccesible.

---

## Estado (2026-11-10)

| Ola | Estado | Evidencia |
|---|---|---|
| 0 — Fundaciones | **Hecha** | `assets/coldops.css` (tokens, `.focus-ring`, `.chip`, `.ico`, piso 12px, `tnum`, reduced-motion) · `assets/icons.svg` (71 símbolos) · `scripts/verify-markup.py` · `scripts/migrate-ola01.py` |
| 1 — Operabilidad | **22 de 22 mecánica** | 266 iconos de ligadura reemplazados por SVG; 0 restantes. Ajustes semánticos a mano en `a4`, `c2`, `b0`, `b1`, `b2`, `c1` |
| 2 — Sistema | **Hecha** | `assets/components.css` (8 componentes) · `DESIGN.md` · `scripts/normalize-nav.py` (una sola TabBar) |
| 3 — Specificity | **Paneles hechos** | `a4` cliente (estado de su servicio) · `b0` técnico (cola ahora/después) · `c0` proveedor (bandeja con plazo). Cero hero-metric, cero eyebrow, 1 CTA relleno por pantalla |
| 4 — Lo que falta | **Parcial** | Hecho: 40 etiquetas mono→`cd-overline`, 5 botones sin mayúsculas, `a8` localizado (Nequi/Daviplata, sin CBU/CVU) y con `cd-pill`. Pendiente: 8 halos de offset cero · CDN de Tailwind · estados de carga · 15 pantallas con la composición vieja |
| 5 — Cierre | Pendiente | |

**Localización (2026-11-10):** mercado Colombia. Bogotá/Cundinamarca, NIT/DIAN, nevera/lavadora/mantenimiento, montos en COP ×6,5 desde los valores AR (ilustrativos). Voseo neutralizado (23 → 0). `scripts/localizar-co.py` y `scripts/neutralizar-voseo.py` quedan como registro de la decisión.

### Pantallas compuestas (Ola 3 + 4)

| Compuesta | Qué se hizo |
|---|---|
| `a4` cliente | OT activa como pantalla; sin KPI ni eyebrow |
| `b0` técnico | cola ahora/después + ofertas con banda de tarifa y estado *fuera de radio* |
| `c0` proveedor | bandeja con plazo; documentación como tira accionable |
| `a6` seguimiento | `tel:` colombiano (era +54), estrella SVG, CTA de pago en cyan (era ámbar), un solo ping, decimal con coma |
| `a7` presupuesto | etiquetas al sistema, CTA sin halo ni mayúsculas, fuera la nota de roadmap |
| `a8` pago | Nequi/Daviplata en vez de Mercado Pago/CVU, chips y etiquetas al sistema, `value` coherente |
| `b2` mis OTs | `max-w` 390 (era 420), calle de Buenos Aires fuera, chips con `aria-pressed`, halo fuera, un solo ping |
| `c1` insumos | 10 `cd-pill`, acciones de fila a 44 px, "Rechazar" legible como destructivo (era gris de deshabilitado), halo fuera |
| `a3` cuenta y rol | Fuera "Predeterminado" (duplicaba "En uso" y no hay acción para fijarlo); halos fuera |
| `b4` perfil técnico | **COPITEC** e **INTI** (instituciones argentinas) → Consejo Nacional / certificación de gases; halos fuera |
| `a1` login | `@coldday.com.ar` → `.co`; fuera la píldora "SISTEMA ACTIVO"; error con `role="alert"` + `aria-invalid` + `aria-describedby` y borde rojo en el campo culpable |
| `a2` registro | Selector de tipo de cuenta: era un `<nav>` sin estado → `role="group"` + `aria-pressed` + JS; fuera el último `onclick` inline; toggle de contraseña con `aria-pressed` y etiqueta que cambia |
| `a3.1` perfil cliente | Los tabs tenían `aria-selected` pero **ningún `aria-controls` ni `tabpanel`**: el panel no existía para el lector. Ahora ambos tabs apuntan a `#panel-perfil` |
| `b1` radar | Tarifa única inventada → **banda** (`$1.400.000 – $1.800.000`), como el `TarifaEstimadaApiResponse`; fuera la barra ámbar lateral (urgencia ya está en la píldora), fuera el control de desarrollo "Simular sin ofertas" y el `pulse-radar` infinito |

**Pendientes de componer (3 + 4):** `a10` y `b3` siguen con la composición vieja (0 referencias a `cd-*`); `c2` ya está compuesta. Los 4 de `flujo-solicitud` usan su propio sistema y sólo necesitan el pase de tokens.

**Pendiente de estados (siguiente ola):** el estado vacío del radar se retiró con el simulador; hay que diseñarlo junto con carga, vacío y error de las 22 pantallas.

**Tablero:** `22/22` · 0 `onclick` inline · 0 halos · 0 mono-uppercase · 0 botones en mayúsculas · 0 fugas de mercado · 0 foco borrado.

**Barrido del set:** 0 términos argentinos · 0 halos de offset cero · 0 etiquetas mono-uppercase · 0 botones en mayúsculas · 7 indicadores `animate-ping` (revisar cuáles son "live" real).

**Superada, no borrada:** `a5_solicitar_servicio_paso_1` duplica un flujo que `flujo-solicitud/a5-1..3` resuelve mejor (3 pasos, `radiogroup` correcto). No se recomienda implementarla; queda en el árbol hasta que el equipo confirme borrarla.

Verificador: **22/22 sin hallazgos**. Observación visual: `comparativa-piso-12px.html` (antes/después, 18 pantallas, requiere red para el CDN). Correr el verificador con:

```powershell
python scripts/verify-markup.py                 # todo
python scripts/verify-markup.py <ruta.html>     # una pantalla
```

Backup del estado previo a la Ola 0/1: `docs/design/dark-ops.bak-20261110/`.

**Límite de este entorno:** no hay navegador utilizable (Chrome no arranca bajo el sandbox y no hay red para el CDN de Tailwind), así que la verificación es de marcado, no visual. El primer render real hay que hacerlo en una máquina con red y contar como aceptación de la ola.

---

## Ola 0 — Fundaciones invisibles (bloquea todo)

Sin esto, cualquier arreglo posterior se reescribe.

| # | Entregable | Detalle |
|---|---|---|
| 0.1 | `tokens.css` | 1 solo archivo. 5 roles de color (acción `#22d3ee`, éxito `#22c55e`, atención `#f59e0b`, repuesto `#a78bfa`, error `#f87171`), 3 superficies (`#0b1220`/`#111b2e`/`#16223b`), texto en 4 pasos (`#f8fafc`/`#e2e8f0`/`#cbd5e1`/`#94a3b8`), **`#64748b` y `#475569` prohibidos en texto** |
| 0.2 | Escala tipográfica | 12 / 13 / 16 / 20 / 28. Piso 12px. Mono (`Space Mono` o `JetBrains Mono`) solo ID, monto, hora |
| 0.3 | `.focus-ring` | `focus-visible:ring-2 ring-[#22d3ee] ring-offset-2 ring-offset-[#0b1220]`, aplicado a todo input/button/a |
| 0.4 | Sprite SVG de iconos | ~20 glifos, 24px, trazo 1.75, `aria-hidden="true"`; reemplaza el font de Material Symbols |
| 0.5 | Viewport | `width=device-width, initial-scale=1, viewport-fit=cover` en las 22 (fuera `user-scalable=no`) |
| 0.6 | Baseline en git | `docs/design/dark-ops/` está **sin trackear**: commitear el estado actual antes de tocar nada |

**Aceptación:** las 22 pantallas siguen pareciendo el mismo producto, ahora con tokens; ninguna pierde contraste.

---

## Ola 1 — Operabilidad (P0)

Objetivo: se puede completar la tarea con teclado y lector de pantalla.

| # | Alcance | Archivos |
|---|---|---|
| 1.1 | Tarjetas-OT → `<a>`/`<button>` real (hoy `<article cursor-pointer>`) | `a4:158,180,205` · `a10` · `c0` · `b1:191` · `a5-1:208` |
| 1.2 | Foco visible en los 15 controles que lo borran | `a2:159,172,188,205` · `a5:194` · `a7:241-266` · `b0:147` · `b4:166` · `a5-1:138` · `a5-2:240` |
| 1.3 | Iconos: `aria-hidden` + `aria-label` en el control; nada de ligaduras como texto | los 287 spans |
| 1.4 | Toggles con `<label>` envolvente y `role="switch" aria-checked` | `b0:145-148` (hoy sin label, click en el riel no alterna) · `b1:129` (sin `aria-pressed`) · `b4:165` (knob nieto: `peer-checked` no lo mueve) |
| 1.5 | `aria-live="polite"` en contador de ofertas, vencimiento y cambios de estado | `b1:145` · `b0` "Expira en 00:42" · `c0` contadores |
| 1.6 | Targets ≥44px conservando el glifo | `a10:92,103` · `a4:104` · `a3:85,91,95,122` · `b0:96,106` · `b2:67` · **`a5-1:141` (28px)** |
| 1.7 | `alt` real en las 4 imágenes con `data-alt` | `a3:109` · `b0:110` · `b4:116` · `c2:86` |
| 1.8 | Error anunciado: `role="alert"` + `aria-describedby` en los campos; login sin error por defecto | `a1:99,106` · `a2:172` (ya correcto, replicar) |

**Aceptación:** recorrido completo de las 3 audiencias con Tab y con NVDA/VoiceOver, sin ratón. Ningún control inalcanzable, ningún icono leído por su nombre de ligadura.

---

## Ola 2 — Sistema de diseño

Objetivo: dejar de reescribir el mismo componente. Hoy hay 4 bottom-navs, 3 headers y 4 vocabularios de token.

| # | Entregable |
|---|---|
| 2.1 | `DESIGN.md` generado desde el código real (`/impeccable document`) |
| 2.2 | 8 componentes: `AppBar`, `TabBar`, `StatusPill`, `MetricTile`, `ListCard`, `CTA`, `Field`, `EmptyState` |
| 2.3 | `TabBar` única: `fixed inset-x-0 bottom-0 mx-auto w-full max-w-[390px]` (arregla `a3:296` y `a5-2:264`, que quedan pegadas a la izquierda, y `b2:195`, que se estira a todo el viewport) |
| 2.4 | `AppHeader` única (3 variantes hoy); un solo `back` + título + acción |
| 2.5 | Tipografía aplicada: piso 12px, `tabular-nums` en toda cifra, falla del equipo a 16px y 2 líneas (`b1:173` deja de truncar) |
| 2.6 | Mono restringido a dato: sale de nav, secciones y botones |
| 2.7 | Migrar las 18 pantallas al sistema; borrar las 8 clases no-op (`h-4.5`, `px-4.5`, `py-0.2`, `absolute 1`) |

**Aceptación:** una pantalla nueva se arma sin escribir CSS nuevo. Cero hex fuera de `tokens.css`.

---

## Ola 3 — Specificity por audiencia

Objetivo: que cliente, técnico y proveedor **no** vean la misma pantalla.

| Audiencia | Registro | Composición |
|---|---|---|
| **Cliente** | Cálido, orientado a la promesa | Una OT activa grande (quién viene, cuándo, semáforo de estado) + historial colapsado. Sin 3 KPI. |
| **Técnico** | Operativo, de calle | Cola ordenada por *ahora / próximo / después*, distancia y ventana horaria. El dinero es secundario; la urgencia manda. |
| **Proveedor** | Operativo, comercial | Bandeja de solicitudes con plazo visible + facturación como dato de contexto, no como titular. |

Transversal: **borrar los eyebrows** ("DARK OPS", "PANEL DE OPERACIONES", "PANEL DE PROVEEDOR") — el título se sostiene solo — y **eliminar el hero-metric** de 3 KPI en los tres paneles.

**Aceptación:** si se reemplazan las palabras "cliente/técnico/proveedor", las pantallas ya no son intercambiables.

---

## Ola 4 — Lo que falta

| # | Tema | Detalle |
|---|---|---|
| 4.1 | Estados | Carga (skeleton), vacío y error en todas: hoy 2 tienen vacío, 2 error, **0** carga |
| 4.2 | Movimiento | `prefers-reduced-motion` para las 31 animaciones; un solo indicador "live" en vez de 3 `animate-ping`/`pulse` permanentes |
| 4.3 | Profundidad | Fuera halos de offset cero (`a1:111`, `b1:108`) y los 37 `backdrop-blur` decorativos |
| 4.4 | Copy | Un formato de dinero (`$ 1.240.000` + `ARS` contextual), radio coherente (5 vs 15 km), jerga explicada o eliminada (`V-OPS 2.4`, `RT-88`), copy de `c0` reescrito para proveedor |
| 4.5 | Robustez | Tailwind compilado en vez de CDN, 2 familias × 2 pesos, `loading="lazy"` + `width/height` en las 11 imágenes, sin duplicar el `<link>` de fuente |
| 4.6 | Interacción | `onclick` inline fuera (`a2:191`); confirmación en acciones destructivas (aceptar OT, rechazar cotización, cambiar rol) |

**Aceptación:** la app funciona con la red lenta y sin fuentes externas; cada estado tiene diseño.

---

## Ola 5 — Cierre

`/impeccable polish` sobre el set completo, y volver a correr el critique para comparar contra **21/40**.

---

## Riesgo principal

`docs/design/dark-ops/` **no está en git** (untracked en el checkout principal, y el worktree actual no lo tiene). Cinco oleadas de trabajo sin control de versiones es el riesgo más alto de este plan: la ola 0.6 no es opcional.
