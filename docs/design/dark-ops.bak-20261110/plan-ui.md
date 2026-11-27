# Plan de trabajo por oleadas — docs/design/dark-ops

Derivado de [auditoria-ui.md](auditoria-ui.md) (critique 21/40). Orden fijado por vos: **operabilidad → sistema de diseño → lo que falta**. Tono: **registro separado por audiencia** (técnico y proveedor operativos; cliente orientado a la promesa del servicio). Alcance: **todo el set, en oleadas**.

Cada ola termina en un criterio de aceptación verificable. Si una ola no cumple, no arranca la siguiente: el punto del orden es no construir el sistema sobre una base inaccesible.

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
