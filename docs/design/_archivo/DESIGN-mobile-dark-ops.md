# DESIGN.md — Cold Day

Sistema de diseño observado en `docs/design/dark-ops/` y en la implementación Ionic.
Generado a partir del código real; no de una intención.

- **Superficie:** Operate (app de tareas). La ambición se expresa como precisión, no como ornamento.
- **Modos de uso:** tres roles sobre una misma cuenta — cliente, técnico, proveedor.
- **Plataforma:** móvil, 390 px de referencia, tema oscuro único.

---

## 1. Tokens

Fuente de verdad: `assets/coldops.css`. Ningún hex vive fuera de ese archivo.

### Superficies

| Token | Valor | Uso |
|---|---|---|
| `--cd-canvas` | `#0b1220` | fondo de app |
| `--cd-surface` | `#111b2e` | tarjetas, barras |
| `--cd-surface-2` | `#16223b` | hover, filas elevadas |
| `--cd-line` | `#1e293b` | borde por defecto |
| `--cd-line-strong` | `#334155` | borde de control enfocable |

### Roles de color — un rol, un significado

| Rol | Valor | Significa | No significa |
|---|---|---|---|
| `--cd-action` | `#22d3ee` | se toca / acción principal / en curso | "info", precio, etiqueta |
| `--cd-success` | `#22c55e` | completado, aprobado | disponible, en línea |
| `--cd-warn` | `#f59e0b` | atención, plazo, vencimiento | selección |
| `--cd-parts` | `#a78bfa` | repuesto, categoría de insumo | estado |
| `--cd-danger` | `#f87171` | error, rechazo | destructivo secundario |

**Regla:** si es cyan, se toca. Si no se toca, no es cyan.

### Texto

| Token | Valor | Contraste sobre canvas / surface |
|---|---|---|
| `--cd-text-1` | `#f8fafc` | 17,9 / 16,5 |
| `--cd-text-2` | `#e2e8f0` | 15,2 / 14,0 |
| `--cd-text-3` | `#cbd5e1` | 12,6 / 11,6 |
| `--cd-text-4` mínimo | `#94a3b8` | 7,3 / 6,7 |

Prohibidos en texto: `#64748b` (3,6–3,9:1) y `#475569` (2,3–2,5:1). Solo iconografía decorativa.

---

## 2. Tipografía

Dos familias y una mono, todas self-hosted en producción:

| Rol | Familia | Tamaño | Peso |
|---|---|---|---|
| Título de pantalla | Space Grotesk | 20–22 | 700 |
| Título de tarjeta | Space Grotesk | 15 | 700 |
| Cuerpo | Inter | 14–15 | 400 |
| Etiqueta / overline | Inter | 12 | 600, tracking .06–.08em, uppercase |
| Dato máquina (ID, monto, hora) | Space Mono | 12 | 500 |

- **Piso de 12 px.** No hay texto por debajo. `.cd-micro` y `.cd-overline` codifican los dos estilos de 12 px.
- **Mono solo para dato.** IDs (`#CD-8842`), montos (`$ 1.202.500 COP`), horas (`14:32`), matrículas. Nunca para navegación, títulos de sección ni botones.
- **Cifras tabulares** (`.tnum`) en todo monto, contador y horario: las columnas no bailan.
- **Uppercase solo en ≤24 caracteres** y nunca por debajo de 12 px.

### Mercado

Colombia. Bogotá y Cundinamarca; **NIT** (no CUIT), **DIAN** (no AFIP), **nevera** y **lavadora**, **mantenimiento** en vez de "service", montos en **COP** (los de los prototipos son ilustrativos, no una lista de precios).

### Localización: checklist por clase

Cada fuga de la migración AR→CO apareció en una clase distinta, siempre *después* de haber cerrado la anterior. Un diccionario de palabras no alcanza; hay que recorrer estas siete clases en cada pantalla nueva:

| Clase | Ejemplo que se escapó | Correcto |
|---|---|---|
| 1. Ciudades y barrios | CABA, Palermo, Belgrano | Bogotá, Chapinero, Usaquén |
| 2. Calles y direcciones | Av. Cabildo, Virrey Loreto, Scalabrini Ortiz | Calle 72 #10-34, Carrera 11 #85-20 |
| 3. Sustantivos de uso | heladera, lavarropas, "service" | nevera, lavadora, mantenimiento |
| 4. Instituciones | COPITEC, INTI, AFIP | Consejo Nacional, certificación oficial, DIAN |
| 5. Identificadores fiscales | CUIT / CUIL, CBU, CVU | NIT, cuenta bancaria |
| 6. Dominios y teléfonos | `@coldday.com.ar`, `tel:+54…` | `.co`, `tel:+57…` |
| 7. Formatos | `$1.240.000 ARS`, `1.4 km`, `10:30 hs` | `$1.240.000 COP`, `1,4 km`, `10:30` |

Los botones `tel:` y los dominios de correo son los más caros: **marcan a otro país y no se ven en una revisión visual**.

---

## 3. Componentes

Fuente: `assets/components.css`. Ocho piezas; ninguna pantalla inventa una novena.

| Componente | Clase | Regla |
|---|---|---|
| AppBar | `.cd-appbar` | sticky, 56 px mínimos, título truncable, `safe-area` arriba |
| TabBar | `.cd-tabbar` + `.cd-tab` | `fixed inset-x-0 bottom-0 mx-auto w-full max-w-[390px]`; 44 px por tab; activo con `aria-current="page"` |
| StatusPill | `.cd-pill--{action,success,warn,danger,parts,neutral}` | 12 px, uppercase, borde + tinte del mismo rol |
| MetricTile | `.cd-metric` | valor 20 px tabular, etiqueta 12 px; no es un hero-metric decorativo |
| ListCard | `.cd-card` | si se toca, es `<a>`/`<button>`; título a 2 líneas máximo |
| CTA | `.cd-cta` / `.cd-cta--ghost` | 52 px; **uno relleno por pantalla** |
| Field | `.cd-field` | label visible, 48 px, error con `aria-describedby` |
| EmptyState | `.cd-empty` | una línea de qué pasa + una acción |

### Reglas de composición

1. **Máximo 2 niveles de contenedor.** Tarjeta > fila. Nunca tarjeta > tarjeta > tarjeta.
2. **Un solo CTA relleno** por pantalla; el resto es ghost o texto. **Excepción: colas de trabajo** (`c1`, `b2`) — cuando cada fila tiene su propia acción primaria (aprobar un despacho, continuar una ruta), esa acción vive en la fila y puede ser rellena; la regla rige para la acción *de la página*, no para acciones repetidas por ítem.
3. **Si una tarjeta navega, es un enlace.** Nunca `div`/`article` con `onclick`.
4. **Estados completos:** default, hover, focus-visible, active, disabled, cargando, vacío, error.

---

## 4. Accesibilidad — piso no negociable

| Regla | Implementación |
|---|---|
| Zoom permitido | `width=device-width, initial-scale=1, viewport-fit=cover`. Nunca `user-scalable=no` |
| Foco visible | `.focus-ring` / `:focus-visible` con anillo de 2 px y offset. Nunca `outline: none` sin reemplazo |
| Targets | 44×44 mínimo en todo lo tocable; 24×24 absoluto |
| Iconos | SVG propio con `aria-hidden="true"`; el nombre accesible va en el control padre |
| Estado anunciado | `aria-pressed` en toggles de botón, `role="switch"` + `aria-checked` en switches, `aria-live="polite"` en contadores y vencimientos |
| Imágenes | `alt` real; nunca `data-alt` |
| Movimiento | `prefers-reduced-motion` respetado; un solo indicador "live" por pantalla |

---

## 5. Lo que no se usa

Estos son defaults de categoría, no decisiones. Reaparecerlos requiere una razón escrita.

- Eyebrow/overline sobre el título de pantalla ("PANEL DE OPERACIONES" sobre "Hola, Martín").
- Tres KPI de colores como estructura de página (hero-metric).
- Tarjetas dentro de tarjetas.
- `border-left` de color > 1 px como acento en tarjetas o alertas.
- Halos de offset cero (`box-shadow: 0 0 20px rgba(34,211,238,.25)`) como profundidad.
- `backdrop-blur` decorativo (37 usos hoy).
- Mono uppercase como disfraz de "técnico".
- Unicode o emoji como sistema de iconos.

---

## 6. Verificación

Sin navegador se puede verificar el marcado; con navegador, además, el render.

```powershell
python scripts/verify-markup.py        # 22/22 esperado
python scripts/normalize-nav.py        # barra inferior: una sola forma
python scripts/migrate-ola01.py --dry-run <pantalla>
```

`comparativa-piso-12px.html` pone antes/después lado a lado.

## 7. Deuda conocida

| Tema | Estado |
|---|---|
| Tailwind por CDN | pendiente (Ola 4): compilar y eliminar dependencia de red |
| Imágenes remotas `lh3` | pendiente: locales, con `width/height` y `lazy` |
| `b4` switch sin nombre accesible | pendiente: falta definir qué controla |
| Navs y headers: 1 implementación | hecho en el anclaje; el markup sigue unificado por pantalla (Ola 2) |
| Eyebrows y hero-metrics | pendiente (Ola 3): requieren decidir la composición por rol |
