# Rediseño de Seguimiento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en Seguimiento (cliente, móvil) se vea de un vistazo qué está pasando y qué hay que hacer.

**Architecture:** Solo cambia la presentación de `pages/seguimiento-ot` (página, mapa y línea de tiempo). Dos `computed` nuevos en la página deciden la acción del pie y el dato dominante; el sondeo, SSE, pagos y modales no se tocan.

**Tech Stack:** Angular 21 zoneless, Ionic 9, Vitest, CSS en `projects/mobile/src/styles/pantallas.css`.

**Spec:** `docs/superpowers/specs/2026-11-26-rediseno-seguimiento-design.md`

## Global Constraints

- Tema oscuro; sin colores, fuentes ni radios nuevos; leer `DESIGN.md` completo antes de editar.
- Una sola acción rellena, en `ion-footer.cd-footer`; máximo 2 niveles de contenedor; áreas táctiles ≥44 px; texto ≥12 px; mapa `clamp(200px,32dvh,320px)`.
- Se conservan los `data-testid` existentes, salvo `tecnico-rating` y `tecnico-sin-rating`, que desaparecen con su bloque.
- Tuteo, español de Colombia. Dato que el backend no entrega, no se pinta.
- No tocar `backend/` ni `frontend/src` (web y core).
- `npm run ui:check` verde antes y después, sin subir techos.
- Un commit por tarea, `tipo(ámbito): mensaje` en español, con rutas explícitas en `git add` (hay archivos sin seguimiento que no son nuestros) y el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. `ASIGNADA` con la visita sin pagar: el técnico está esperando, así que no se muestra «en camino» ni ETA (Task 2).
2. Un modal abierto: el pie no queda a la vista ni tocable por encima (Task 1).
3. `EN_DIAGNOSTICO` con presupuesto: no hay dos botones al mismo destino (Task 1).
4. Historial con un estado repetido (reasignación) o de un paso al que la orden ya no ha llegado: hora más reciente, y ninguna en pasos no alcanzados (Task 3).
5. Orden sin barrio o técnico sin teléfono o sin nombre: se omite la fila o el botón, sin inventar nada (Task 2).

## Archivos

Todo bajo `frontend/projects/mobile/src/`:

- `app/pages/seguimiento-ot/seguimiento-ot.page.{ts,html,spec.ts}` — Tasks 1 y 2.
- `app/pages/seguimiento-ot/ot-timeline.component.ts` y `ot-timeline.component.spec.ts` (nuevo) — Task 3.
- `app/pages/seguimiento-ot/mapa-seguimiento.component.ts` — Task 4.
- `styles/pantallas.css` — Tasks 2, 3 y 4.
- `DESIGN.md` (raíz del repo) — Task 4.

Comandos desde `frontend/`. Specs de la página:
`npx ng test mobile --watch=false --include='**/seguimiento-ot/**/*.spec.ts'`

---

### Task 1: Acción principal en el pie

**Files:** `seguimiento-ot.page.ts`, `.html`, `.spec.ts`

**Interfaces:**
- Produces: `readonly accionPrincipal: Signal<'pagar-visita' | 'presupuesto' | 'acta' | null>`; `ion-footer.cd-footer[data-testid="ot-pie"]`; `data-testid="ot-acciones"` pasa a las acciones secundarias, al final del contenido.

- [ ] **Step 1: Línea base.** `npm run ui:check` y el comando de specs. Expected: ambos verdes (anota la cuenta de tests).

- [ ] **Step 2: Tests que fallan** (`describe('acción principal en el pie')`, con helper `const nodo = (fixture, id) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`)`):

| Test | OT | Aserciones |
|---|---|---|
| `pagar la visita va en el pie` | `ASIGNADA`, `visitaPagada: false` | `nodo('ot-pie').contains(nodo('pagar-visita'))`; `nodo('panel-pago-visita').contains(nodo('pagar-visita'))` es `false` |
| `revisar presupuesto va en el pie y no se duplica` | `EN_DIAGNOSTICO`, `diagnostico: {}` | pie contiene `cta-presupuesto`; `tecnico-diagnostico` es `null` |
| `ver acta va en el pie y calificar queda abajo sin relleno` | `FINALIZADA` | pie contiene `cta-acta`; `ot-acciones` contiene `cta-calificar`; `cta-calificar` tiene atributo/propiedad `fill` = `outline` |
| `sin acción principal no hay pie` | `EN_CAMINO` | `ot-pie` es `null` |
| `con un modal abierto el pie se retira` | `EN_DIAGNOSTICO`, `diagnostico: {}` | tras `click('cta-disputa')`, `ot-pie` es `null`; tras `click('disputa-volver')`, vuelve |
| `las acciones secundarias van después de la ficha` | `EN_DIAGNOSTICO` | `nodo('timeline-pasos').compareDocumentPosition(nodo('ot-acciones')) & Node.DOCUMENT_POSITION_FOLLOWING` es verdadero |

- [ ] **Step 3: Verlos fallar.** Expected: FAIL por `ot-pie` inexistente (el de «sin acción principal» pasa ya: es la guarda).

- [ ] **Step 4: Implementar.**
  - `accionPrincipal`, en este orden: `puedePagarVisita()` → `'pagar-visita'`; `EN_DIAGNOSTICO && diagnostico` → `'presupuesto'`; `FINALIZADA` → `'acta'`; si no, `null`.
  - Después de `</ion-content>`: `@if (ot() && accionPrincipal() && !mostrarModalCancelar() && !mostrarModalDisputa())` con `<ion-footer class="cd-footer" data-testid="ot-pie">` y un solo botón `expand="block"` según el valor. Se mudan tal cual (testid, clases, icono, texto, `disabled`, `aria-busy`) `pagar-visita`, `cta-presupuesto` y `cta-acta`.
  - El bloque `ot-acciones` pasa a ser lo último dentro del `@if (ot())`, después de la política de cancelación, solo con `cta-disputa`, `cta-calificar` y `cta-cancelar` (todos `fill="outline"`).
  - `tecnico-diagnostico` solo si `accionPrincipal() !== 'presupuesto'`, con texto «Ver diagnóstico».

- [ ] **Step 5: Verlos pasar** junto con los ya existentes. Expected: PASS.

- [ ] **Step 6: Commit** `feat(mobile): accion principal de seguimiento en el pie fijo`.

---

### Task 2: Dato dominante, técnico y ficha del servicio

**Files:** `seguimiento-ot.page.ts`, `.html`, `.spec.ts`, `styles/pantallas.css`

**Interfaces:**
- Produces: 

```ts
type DatoDominante =
  | { tipo: 'buscando' }
  | { tipo: 'en-camino'; etaMin: number | null; distanciaKm: number | null }
  | { tipo: 'llegada'; llegadaEn: string }
  | { tipo: 'estado' };
readonly datoDominante: Signal<DatoDominante | null>; // null sin OT
```

  Sección `section.cd-dato[data-testid="dato-dominante"][aria-live="polite"]`, con el dato grande en `.cd-dato__grande` y lo demás en `.cd-dato__detalle`.

Reglas, en orden:

| Condición | Resultado | `.cd-dato__grande` | Detalle |
|---|---|---|---|
| `SOLICITADA` o `BUSCANDO_TECNICO` | `buscando` | `Buscando técnico` | el aviso actual, con el código |
| `llegadaEn` y estado en `ESTADOS_TECNICO_EN_MOVIMIENTO` | `llegada` | `El técnico llegó` | `llegadaEn \| date: 'medium'` |
| `EN_CAMINO` con `tecnicoId` | `en-camino` | `~14 min`, o `Técnico en camino` sin ETA | `3.2 km` (`number: '1.1-1'`), solo con ETA |
| resto (incluida `ASIGNADA`) | `estado` | etiqueta del estado | `Creada el {{ fechaCreacion \| date: 'medium' }}` si existe |

`data-testid="buscando-tecnico"` va en un hijo de la sección cuando es `buscando` y envuelve grande y detalle; `data-testid="estado-tecnico"`, igual, cuando es `en-camino` o `llegada`.

- [ ] **Step 1: Tests que fallan** (`describe('dato dominante y ficha')`):

| Test | Preparación | Aserciones |
|---|---|---|
| `buscando` | `SOLICITADA`, `tecnicoId: null` | `.cd-dato__grande` = `Buscando técnico`; `buscando-tecnico` contiene `OT-2026-0001` |
| `en camino con ETA` | `EN_CAMINO`, `punto: PUNTO`, ubicación `UBICACION_TECNICO` | grande coincide con `/^~\d+ min$/`; `dato-dominante` contiene `km` |
| `en camino sin ETA` | `EN_CAMINO`, ubicación `null` | grande = `Técnico en camino`; sin `km` en `dato-dominante` |
| `llegó` | `EN_DIAGNOSTICO`, `llegadaEn` | grande = `El técnico llegó` |
| `asignada sin pagar no dice en camino` | `ASIGNADA`, `visitaPagada: false`, con punto y ubicación | grande = `Asignada`; `dato-dominante` sin `min` ni `en camino` |
| `otro estado muestra la fecha` | `FINALIZADA`, `fechaCreacion` | grande = `Finalizada`; detalle contiene `Creada el` |
| `ya no hay calificación del técnico` | `EN_CAMINO`, `tecnicoReputacion: 4.7` | `tecnico-card` sin `Sin rating` ni `4.7` |
| `sin barrio no inventa Centro` | sin `barrio` | el texto no contiene `Centro` ni la fila `Barrio` |
| `técnico sin nombre ni teléfono` | `tecnicoNombre: undefined`, sin teléfono | `tecnico-card` contiene `Técnico asignado`, no `Buscando`; `tecnico-llamar` es `null` |
| `una sola ficha con la falla` | `descripcionFalla` por defecto | `[data-testid="ficha-servicio"]` contiene `No enfría y gotea agua.` y `Garantía` |
| `el dato va antes del pago y del técnico` | `ASIGNADA` sin pagar | orden en el DOM: `dato-dominante`, `panel-pago-visita`, `tecnico-card`, `timeline-pasos`, `ficha-servicio` |

Se sustituyen los dos tests de reputación existentes (`sin técnicoReputacion…`, `con técnicoReputacion…`) por `ya no hay calificación del técnico`: la spec quita ese bloque.

- [ ] **Step 2: Verlos fallar.** Expected: FAIL por `dato-dominante` inexistente.

- [ ] **Step 3: Implementar.**
  - `datoDominante` según la tabla; la tarjeta `cd-buscando` desaparece y su aviso e icono pasan a la sección.
  - Orden del contenido: mapa, dato, panel de pago, técnico, línea de tiempo, ficha, política, acciones.
  - Técnico: inicial, nombre (`orden.tecnicoNombre || 'Técnico asignado'`), teléfono, «Llamar», «Ver diagnóstico». Fuera la línea de estado y el rating; borra `ratingTecnico()`.
  - Ficha única `ion-card.cd-ficha[data-testid="ficha-servicio"]`, título «Servicio»: Línea, Dirección, Barrio (solo con `orden.barrio`), Garantía, Total cotizado y «Falla reportada» + descripción. Desaparecen `cd-detalle` como tarjeta, la fila «Llegada estimada» y `cd-columnas`.
  - Cabecera: se quita el párrafo `cd-hero__nota`.
  - CSS: `.cd-dato` (superficie `--cd-surface`, borde `--cd-surface-border`, radio `--cd-radius-card`, padding 1rem, margen inferior 0.75rem); `.cd-dato__grande` con `--cd-font-head`, 1.75rem, `tnum`; `.cd-dato__detalle` 0.8rem `--cd-muted`; `min-height: 44px` para `.cd-tecnico__acciones .cd-boton-superficie` y `.cd-chip-pago`. Borra las reglas que queden sin uso (`cd-tecnico__rating`, `__sin-rating`, `__estado`, `__icono`, `__llego`, `__camino`, `cd-columnas`, `cd-buscando*`), solo tras confirmar con búsqueda que nadie más las usa.

- [ ] **Step 4: Verlos pasar** y `npm run ui:check`. Expected: PASS, sin techos arriba.

- [ ] **Step 5: Commit** `feat(mobile): dato dominante y ficha unica en seguimiento`.

---

### Task 3: Línea de tiempo vertical con horas

**Files:** `ot-timeline.component.ts`, `ot-timeline.component.spec.ts` (nuevo), `styles/pantallas.css`

**Interfaces:**
- Consumes: entradas actuales `estadoActual` e `historial`.
- Produces: `protected horaDePaso(paso: TimelinePaso): string | null`; la hora se pinta en `.cd-timeline__hora` con `date: 'short'`.

- [ ] **Step 1: Tests que fallan** (componente aislado, `fixture.componentRef.setInput`):
  - `pone la hora en los pasos alcanzados`: `estadoActual: 'EN_CAMINO'`, historial con `SOLICITADA` y `EN_CAMINO` → `timeline-paso-SOLICITADA` y `timeline-paso-EN_CAMINO` tienen `.cd-timeline__hora`; `timeline-paso-ASIGNADA` (sin entrada) no.
  - `con un estado repetido usa la más reciente`: dos entradas `ASIGNADA` (`2026-11-03T10:00:00Z` y `2026-11-05T10:00:00Z`, en ese orden y también invertidas) → el texto del paso contiene `11/5` y no `11/3` (si el locale del test formatea distinto, compara con `formatDate` del mismo locale).
  - `un paso no alcanzado no muestra hora`: `estadoActual: 'BUSCANDO_TECNICO'` con entrada vieja de `ASIGNADA` → sin `.cd-timeline__hora` en `ASIGNADA`.
  - `el historial sigue plegado`: `timeline-historial` existe y no tiene `open`.

- [ ] **Step 2: Verlos fallar.** Expected: FAIL por `.cd-timeline__hora` inexistente.

- [ ] **Step 3: Implementar** `horaDePaso`: `null` si el paso no es `isCompleted` ni `isCurrent`; si no, la `fecha` máxima entre las entradas con ese `estado`. CSS: `.cd-timeline__pasos` en columna, sin scroll horizontal; cada paso en fila (nodo, etiqueta, hora a la derecha), con un conector vertical de 2 px `--cd-surface-border` entre nodos; `min-height: 44px` en `.cd-timeline__historial-toggle`.

- [ ] **Step 4: Verlos pasar** y `npm run ui:check`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(mobile): progreso vertical con horas en seguimiento`.

---

### Task 4: Mapa a todo el ancho y regla de diseño

**Files:** `mapa-seguimiento.component.ts`, `seguimiento-ot.page.{html,spec.ts}`, `styles/pantallas.css`, `DESIGN.md`

**Interfaces:**
- Consumes: `section.cd-dato` (Task 2), `mostrarSeguimientoActivo()`.
- Produces: `.cd-mapa-bloque` a sangre; modificador `.cd-dato--sobre-mapa` cuando hay mapa.

- [ ] **Step 1: Tests que fallan:**
  - `el mapa no lleva título propio y su chip va dentro del lienzo`: `EN_CAMINO` con punto y ubicación → el texto no contiene `Seguimiento en vivo`; `.cd-map__lienzo` contiene `mapa-distancia`.
  - `ya llegó también va sobre el mapa`: con `llegadaEn` → `.cd-map__lienzo` contiene `mapa-llegada`.
  - `el mapa va primero y el dato se monta sobre él`: `.cd-mapa-bloque` precede a `dato-dominante`, que tiene `cd-dato--sobre-mapa`; en `SOLICITADA` no la tiene.

- [ ] **Step 2: Verlos fallar.** Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - Plantilla del mapa: fuera `cd-map__cabecera`; los dos chips pasan dentro de `cd-map__lienzo`. `mapa-resumen` se conserva como texto solo para lector de pantalla (clase `cd-sr-only`; créala si no existe).
  - CSS: `.cd-mapa-bloque` con margen `-1rem -1rem 0` **solo en esta pantalla** (`app-seguimiento-ot .cd-mapa-bloque`, porque `ofertas-tecnico` usa la misma clase); lienzo sin radio ni bordes laterales y con `padding-bottom: 1.5rem`; `.cd-dato--sobre-mapa { margin-top: -1.5rem; position: relative; z-index: 1; }`. La tarjeta se monta sobre esa franja, no sobre el mapa, para no tapar la atribución del proveedor.
  - Chips: posición absoluta arriba a la izquierda (0.6rem), `z-index: 1`, fondo `--cd-surface`.
  - Borra `cd-map__cabecera`, `__titulo`, `__nota` solo si la búsqueda confirma que no hay otro uso.
  - `DESIGN.md` §0.1, bajo la tabla: «Para Seguimiento (cliente), la referencia de estructura es `docs/superpowers/specs/2026-11-26-rediseno-seguimiento-design.md` (2026-11-26), no el prototipo a6.» Es la única excepción a «nunca en un documento paralelo» y la aprobó el dueño.

- [ ] **Step 4: Verificación completa.** `npm run ui:check`, `npm run mobile:test`, `npm run mobile:build`. Expected: los tres verdes. Pega las salidas.

- [ ] **Step 5: Commit** `feat(mobile): mapa a todo el ancho en seguimiento`.

**Sin verificar al terminar:** el aspecto en 320–768 px y en teléfono real; lo revisa el dueño con el APK (spec). `MOBILE_API_ORIGIN` y `.env` no se tocan.
