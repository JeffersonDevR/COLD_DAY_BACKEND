# Critique — docs/design/dark-ops/ · Cold Day

**Method: dual-agent (A: `ae10561c` · B: `c771df79`) · `impeccable detect` no corrió**: la skill se instaló sin `scripts/` y este shell no tiene salida a red, así que el scan determinista se reemplazó por barrido estático + aritmética WCAG. Sin navegador: no hay overlay ni contraste renderizado.

Fecha: 2026-11-10 · Target: 22 archivos HTML (`docs/design/dark-ops/`) + 5 capturas.

## Design Health Score

| # | Heurística | Score | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Píldoras, pasos y timers existen, pero **0 `aria-live`**: "Expira en 00:42" (`b0`) no tiene estado al llegar a cero |
| 2 | Sistema ↔ mundo real | 3 | Vocabulario de oficio impecable, arruinado por flavor text ("V-OPS 2.4", "RT-88") y copy de técnico en pantalla de proveedor (`c0`) |
| 3 | Control y libertad | 2 | Aceptar OT no se deshace ni se confirma (`b1:191`, `c0`); cambio de rol sin confirmar (`a3`) |
| 4 | Consistencia y estándares | 2 | 4 bottom-navs, 3 headers, 4 vocabularios de token + hex crudo, 3 formatos de dinero, 3 verdes para "activo" |
| 5 | Prevención de errores | 2 | El login entrega error por defecto (`a1:99,106`); acciones destructivas sin guardrail |
| 6 | Reconocer > recordar | 3 | IDs a la vista, pero `a10` parte "#CD-8819" en dos líneas; el radio es 5 km (`b1:149`) o 15 km (`c0`) |
| 7 | Flexibilidad y eficiencia | 2 | Sin búsqueda, sin filtros persistentes, sin lote; chips con scroll oculto (`a4:136`, `a10:110`) |
| 8 | Estética y minimalismo | 2 | Card soup de 3 niveles; **263** declaraciones de 9–11px; píldoras redundantes ("En uso" + "Predeterminado") |
| 9 | Recuperación de errores | 1 | Solo `a2` asocia el error al campo; el resto es un texto rojo. La excepción buena es `c2:228`, que explica el rechazo |
| 10 | Ayuda y documentación | 1 | Nada explica garantía, acta ni "presupuesto aprobado"; sin onboarding |
| **Total** | | **21/40** | **Acceptable (bajo) — mejoras significativas antes de que el usuario esté conforme** |

## Design Specificity Verdict

**LLM:** el producto es específico en su **contenido** y genérico en su **estructura**. Lo anclado es real y valioso: OT `#CD-8842`, matrícula `MAT #4829`, `COP-BA #882190-A`, R410A, acta, CUIT, voseo, CABA/Palermo, pesos con punto de miles. Lo genérico es la composición: tres KPI de colores + tarjetas dentro de tarjetas + tab bar de tres + píldoras de estado. La prueba dura: **`a4` (cliente), `b0` (técnico) y `c0` (proveedor) son la misma pantalla con etiquetas cambiadas** — tres personas con objetivos opuestos y un solo template. Se podría revender a una flota de logística cambiando tres tokens.

**Scan determinista:** no disponible (ver header). Barrido estático equivalente: 22 archivos, **0 `@media`**, 5–21 hex por archivo, 4 vocabularios de token que además no coinciden entre pantallas (`brand-*` en `a10`, Material `on-surface-variant` en `b0/b1/b4`, kebab semántico en `a2`, **camelCase** `primaryCyan/borderLine` en `a1/a5`, y hex crudo en `a7/a8/b2/c0/c1/c2`).

**Overlays:** no hay. No se inyectó nada en el navegador; cualquier afirmación de overlay sería falsa.

## Overall Impression

Hay dirección de arte, y es coherente: frío industrial, cyan como acento operativo, mono para el dato de máquina. El problema no es el gusto, es que el sistema **no está construido** — está reescrito 18 veces. Los dos momentos más sensibles del producto (documentación rechazada, aceptar una OT) son los más frágiles. Y la interfaz no se puede operar sin verla: eso convierte un buen look en un producto inaccesible.

## What's Working

1. **`flujo-solicitud/a5-2-detalle.html` es el techo del proyecto.** `radiogroup` + `role="radio"` + `aria-checked`, tarjetas de 96px con hit area completa, dictado por voz de 44px, cero truncamiento. Ya resuelve todo lo que el resto del set no.
2. **La IA de roles está bien pensada.** `a3` resuelve "una identidad, tres oficios" con borde-2 + check + "Usar este modo" a 44px; sin menús escondidos ni modales.
3. **La tabla de tokens de `flujo-solicitud/README.md` prohíbe `#64748b` explícitamente.** El equipo ya piensa en contraste y no en gustos: solo hay que hacer que el código lo cumpla.

## Priority Issues

### [P0] La interfaz no se puede operar sin verla

`a4:158,180,205` son `<article class="… cursor-pointer">` sin `role`, `tabindex` ni teclado; igual `a10`, `c0`, `b1`, `a5-1:208`. Y **15** controles borran el foco (`focus:outline-none`/`focus:ring-0`) con un solo reemplazo en todo el set (`estados-cta:61`): `a2:159,172,188,205` · `a5:194` · `a7:241,248,255,266` · `b0:147` · `b4:166` · `a5-1:138` · `a5-2:240`.

- **Por qué importa:** con teclado o lector de pantalla no se puede abrir una OT ni saber dónde está el cursor. Es la tarea principal del producto. WCAG 2.4.7 y 2.1.1.
- **Fix:** `<a>`/`<button>` envolviendo el contenido de la tarjeta (no `div`+`onclick`), y una clase `.focus-ring` global con `focus-visible:ring-2` + offset sobre `#0b1220`.
- **Comando:** `/impeccable audit`

### [P0] Los iconos se vuelven palabras

287 spans de Material Symbols, **4** con `aria-hidden`; 18 archivos cargan la misma hoja **dos veces**; sin fallback si la fuente no llega. Verificado en `c2/screen.png`: "check_circle APROBADO", "upload_file Subir documento", "inventory_2 SOLICITUDES", "calendar_today". Dos fallas en una: la pantalla más sensible queda ilegible sin red, y el lector anuncia el nombre de la ligadura.

- **Por qué importa:** el técnico en la calle con mala señal es el usuario real; y `c2` es justo el momento en que el proveedor teme perder su habilitación.
- **Fix:** sprite SVG inline, 24px, un solo grosor de trazo, `aria-hidden="true"` + `aria-label` en el control padre. `flujo-solicitud/` ya usa SVG: ese es el patrón a replicar.
- **Comando:** `/impeccable polish`

### [P1] Una sola plantilla para tres oficios (la raíz del problema de specificity)

Cliente, técnico y proveedor comparten esqueleto, densidad y jerarquía. Encima se apoya en tres patrones que el craft floor marca como default de categoría: **hero-metric** (los 3 KPI de color: `a4:118`, `b0:156`, `c0:141`), **eyebrow sobre el título** ("DARK OPS" sobre "Mis equipos" en `a10:97`, "PANEL DE OPERACIONES" sobre "Hola, Martín" en `a4:95`, "PANEL DE PROVEEDOR" en `c0:101`), y **tarjetas dentro de tarjetas** (`b0:196` mete un panel de cliente/distancia/ubicación dentro de la tarjeta de OT).

- **Por qué importa:** si las tres vistas se leen igual, el usuario no cambia de sombrero: cambia de etiqueta. Y el técnico en la calle necesita una cola, no un dashboard.
- **Fix:** tres composiciones, un sistema. **Cliente** = estado y promesa (una OT activa grande + historial colapsado; el KPI no aporta). **Técnico** = cola y urgencia (lista ordenada por "ahora / próximo / después", distancia y ventana horaria; el dinero no es el eje). **Proveedor** = pedidos y dinero (bandeja de solicitudes con plazo, facturación como dato secundario). Borrar el eyebrow: el título se sostiene solo.
- **Comando:** `/impeccable shape` → `/impeccable layout`

### [P1] La tipografía va contra el uso real

263 declaraciones a 9–11px (máx. `a4`=26, `c0`=25); el campo que decide la acción —la falla del equipo— está truncado a una línea (`b1:173` `line-clamp-1`); **0** `tabular-nums` con montos en columna (`b2:83-135`, `c0:146-172`); 14 de 22 pantallas bloquean el zoom; `#64748b` a 3,62–3,93:1 en 39 usos (y `a2:33` lo **declara como token**, usado 21 veces); placeholders slate-600 a 2,47:1.

- **Por qué importa:** el uso real es un técnico con guantes, al sol, a 40 cm o a 2 m. Ahí 9px uppercase con tracking no es densidad: es ruido. Y los dígitos proporcionales hacen bailar las cifras entre tarjetas.
- **Fix:** piso de **12px** para etiquetas y 14–15 para cuerpo; mono solo para ID, monto y hora (hoy también rotula navegación y secciones); la falla a 16px y dos líneas, sin truncar; `tabular-nums` en toda cifra; viewport sin `user-scalable=no`; `text-dim → #94a3b8` (7,30:1).
- **Comando:** `/impeccable typeset`

### [P2] El color y el mono no significan nada fijo

Cyan es acción, información, "activo", precio y etiqueta a la vez. "Activo" tiene tres colores (`a1` cyan, `c0`/`c2` esmeralda, `a10` ámbar). `b0` mezcla estado, período y agregado en ACTIVO/HOY/TOTAL. Y el mono uppercase se usa como disfraz de "técnico" en vez de para dato: **263** usos, muchos en navegación y títulos de sección. Sumá 37 `backdrop-blur` decorativos y halos de offset cero (`a1:111` `shadow-[0_0_20px_rgba(34,211,238,.25)]`, `b1:108` `cta-glow`): profundidad falsa.

- **Por qué importa:** cuando todo grita igual, el usuario deja de leer los estados — y el estado es el producto.
- **Fix:** cinco roles fijos (acción=cyan, éxito=verde, atención=ámbar, repuesto=violeta, error=rojo) y la regla "si es cyan, se toca". Mono solo dato. Sombra con offset y blur suave, o ninguna. Un solo momento de movimiento por pantalla.
- **Comando:** `/impeccable colorize` → `/impeccable quieter`

## Persona Red Flags

**Sam (lector de pantalla / solo teclado):** 14 pantallas bloquean el zoom (`user-scalable=no, maximum-scale=1`); los 287 iconos se anuncian por su nombre; las 4 imágenes con `data-alt` (`a3:109`, `b0:110`, `b4:116`, `c2:86`) no tienen `alt` y el lector lee la URL; sin `aria-live` para contadores ni vencimientos; foco invisible en `a2` y en los dos switches; las tarjetas-OT no son alcanzables. Abandona en la primera tarea.

**Casey (móvil, una mano, con guantes, a la intemperie):** targets de 36px (`a10:92,103`, `a4:104`, `b0:96,106`, `b2:67`) y uno de **28px** (`a5-1:141`); "Radio: 5 km" mide ~30px (`b1:148`); las etiquetas de 9px de `b0:160-184` son ilegibles al sol; la fila de chips de `a10` corta "Heladeras (1)" sin indicar scroll; "Deslizá para actualizar" (`a4:111`) es una affordance que no hace nada.

**Jordan (primerizo):** "DARK OPS", "V-OPS 2.4", "RT-88", "SIN TÉCNICO", "Acta de servicio" no se explican en ningún lado; después de "Aceptar" no hay confirmación ni próximo paso; "En uso" y "Predeterminado" en la misma tarjeta (`a3:151,171`) es un acertijo.

## Minor Observations

- **Bottom-nav, 4 estrategias de anclaje.** `a3:296` y `a5-2:264` usan `left-0 … mx-auto`: con `left:0` y `right:auto` **no centran**, quedan pegadas a la izquierda en escritorio. `b2:195` (`inset-x-0` sin `max-w`) se estira a todo el viewport mientras el contenido mide 390px. Un componente: `fixed inset-x-0 bottom-0 mx-auto w-full max-w-[390px]`.
- **8 clases Tailwind no-op que sí cambian el render:** `a4:106` (`class="absolute 1 …"`, un `1` residual), `b1:135,339,346` (`h-4.5` ⇒ track de altura 0), `b1:230,269` (`px-4.5` ⇒ sin padding), `b2:90` y `c0:268` (`py-0.2` ⇒ badge sin padding).
- **`b0:135-138` se pisa:** la píldora "Visible en el radar" pasa por debajo del switch y el track desborda la tarjeta. Causa: columna flex sin `min-w-0`/`flex-wrap` junto a un `shrink-0`.
- **Toggle sin nombre accesible:** `b0:146` es `<input class="sr-only peer">` sin `<label>`; el track es un `div` hermano, así que el click sobre él no alterna. `b4:165` sí lo hace bien; `b1:129` es un `<button>` sin `aria-pressed`. Cero `role="switch"` en el set.
- **31 animaciones, 0 `prefers-reduced-motion`**, incluidos `animate-ping`/`pulse` infinitos (`b0:136`, `b1:131`, `a4:112`).
- **Todo depende de la red:** cada pantalla carga 3 hojas de Google Fonts + Tailwind CDN (JIT en runtime) + imágenes de `lh3`; 4–5 familias y 13–18 pesos; `a1:11-12` duplica el link de Material Symbols (18 archivos lo hacen); 11 imágenes, **0** `lazy`, **0** con `width/height`.
- **Formatos de dinero:** `$185.000`, `$48.500 ARS`, `$ 86.000`, `ARS` — elegí uno (`$ 1.240.000` + "ARS" en el contexto).
- **Datos que se contradicen:** radio 5 km (`b1:149`) vs 15 km (`c0:257`); "4 activas" junto a una bandeja con 2 tarjetas (ambiguo, no contradicción: verificado).
- **Estados faltantes:** solo 2 pantallas tienen vacío (`a10`, `c0`), 2 tienen error (`a1`, `a2`), **0** tienen carga. No hay skeletons en un producto que depende de red móvil.
- `onclick` inline en `a2:191` donde `a1` usa `addEventListener`; `b4:166` el knob es nieto del `<label>`, así que `peer-checked:translate-x-6` no lo mueve (inferido de CSS, no verificado en navegador).

## Questions to Consider

1. Si cliente, técnico y proveedor ven el mismo shell, ¿qué diseña el producto además de cambiar etiquetas?
2. ¿La mono uppercase de 9–11px está porque el técnico necesita densidad, o porque "se ve técnico" a 100% en tu monitor? Mostralo a 2 m, con sol.
3. ¿Qué pasa exactamente cuando "Expira en 00:42" llega a cero? Si el prototipo no lo responde, el usuario tampoco.

## Metadatos de la corrida

- Heurísticas: 10 aplicables, máximo 40, total 21.
- Prioridades: P0 = 2 · P1 = 2 · P2 = 1.
- Trend: primera corrida para este target, sin tendencia.
- Persistencia: `.impeccable/critique/` no escrita (helper `critique-storage` no instalado).
