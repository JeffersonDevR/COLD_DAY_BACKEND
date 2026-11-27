# Rediseño de paneles (cliente y técnico) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en cada panel la orden activa se lea primero y tenga la única acción destacada.

**Architecture:** Una tarjeta presentacional compartida (`shared/ui/orden-activa`) y las reglas puras de la orden en `shared/orden-reglas.ts`, que también consume Seguimiento. Cada panel decide textos, destino y orden de bloques; servicios, sondeo y SSE no cambian.

**Tech Stack:** Angular 21 zoneless, Ionic 9, Vitest, CSS en `projects/mobile/src/styles/pantallas.css`.

**Spec:** `docs/superpowers/specs/2026-11-27-rediseno-paneles-design.md`

## Global Constraints

- Solo `frontend/projects/mobile/src/`, `DESIGN.md` y `docs/design/NAVEGACION.md`. No tocar `backend/` ni `frontend/src` (web y core).
- Sin colores, fuentes ni radios nuevos; leer `DESIGN.md` completo antes de editar; máximo 2 niveles de contenedor; targets ≥44 px; texto ≥12 px.
- Una sola acción rellena a la vista cuando hay tarjeta activa.
- Tuteo, español de Colombia. Dato que el backend no entrega, no se pinta.
- `npm run ui:check` antes y después de cada tarea, sin subir techos.
- Las pruebas existentes de Seguimiento no se modifican. En los paneles solo se cambian las que fijan elementos que la spec quita o mueve, y el commit dice cuáles.
- Un commit por tarea, `tipo(ámbito): mensaje` en español, `git add` con rutas explícitas y el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Orden sin técnico, sin dirección o sin código: se omite la línea; nunca «undefined» (Task 1).
2. Un refresco hace que otra orden pida acción: la tarjeta grande cambia a esa (Task 2).
3. La única activa está en disputa: «Ver seguimiento», sin invitar a pagar (Task 2).
4. Técnico bloqueado por liquidación con una orden activa: el aviso queda encima de la tarjeta (Task 3).
5. Deslizar para actualizar con el servidor caído: el indicador se cierra y la lista se conserva (Task 3).

## Rutas y comandos

Rutas bajo `frontend/projects/mobile/src/app/` salvo que se diga otra. Comandos desde `frontend/`.
Specs de un área: `npx ng test mobile --watch=false --include='**/<carpeta>/**/*.spec.ts'`

---

### Task 1: Reglas de la orden y tarjeta compartida

**Files:**
- Create: `shared/orden-reglas.ts`, `shared/orden-reglas.spec.ts`
- Create: `shared/ui/orden-activa/orden-activa.ts`, `orden-activa.spec.ts`
- Modify: `pages/seguimiento-ot/seguimiento-ot.page.ts` (`puedePagarVisita`, `accionPrincipal`), `../styles/pantallas.css`, `DESIGN.md` §5 (fila de la tabla)

**Interfaces (Produces):**

```ts
export type AccionOt = 'pagar-visita' | 'presupuesto' | 'acta' | null;
export function puedePagarVisita(ot: OtResponse): boolean;
export function accionOtCliente(ot: OtResponse): AccionOt;
export function tituloEstadoOt(ot: OtResponse): string;
```

Componente `OrdenActivaComponent`, selector `cd-orden-activa`:
- Inputs: `estado` (requerido, texto grande), `categoria` (requerido), `codigo?: string`, `prioridad?: Prioridad`, `contexto: readonly string[] = []`, `direccion?: string`, `accion` (requerido, texto del botón).
- Output: `accionar: void`.
- DOM: `section[data-testid="orden-activa"].cd-orden-activa`; `.cd-dato__grande[aria-live="polite"]` con `estado`; `app-priority-chip` solo si hay `prioridad`; `ion-button[expand="block"][data-testid="orden-activa-accion"].cd-cta`.

- [ ] **Step 1: Línea base.** `npm run ui:check` y `npm run mobile:test`. Anota la cuenta de tests (446 al 2026-11-27).

- [ ] **Step 2: Tests que fallan.**

`orden-reglas.spec.ts` (tabla `it.each`):

| OT | `accionOtCliente` | `tituloEstadoOt` |
|---|---|---|
| `ASIGNADA`, `visitaPagada: false` | `'pagar-visita'` | `Asignada` |
| `ASIGNADA`, sin `visitaPagada` | `null` | `Asignada` |
| `DISPUTADA` y `CANCELADA` | `'pagar-visita'` | etiqueta de `ETIQUETA_ESTADO_OT` |
| `EN_DIAGNOSTICO`, `diagnostico: {}` | `'presupuesto'` | etiqueta |
| `EN_DIAGNOSTICO` sin diagnóstico | `null` | etiqueta |
| `FINALIZADA` | `'acta'` | `Finalizada` |
| `SOLICITADA`, `BUSCANDO_TECNICO` | `null` | `Buscando técnico` |
| `EN_CAMINO` y `ASIGNADA` con `llegadaEn` | — | `El técnico llegó` |
| `EN_DIAGNOSTICO` con `llegadaEn` | — | etiqueta |

`orden-activa.spec.ts`:
- `pinta el estado grande y un solo botón`: un `ion-button`; `.cd-dato__grande` = el `estado` dado.
- `emite al tocar el botón`: `accionar` se emite una vez.
- `omite lo que no llega`: solo con `estado`, `categoria`, `accion` → sin `undefined`, sin `.cd-orden-activa__contexto`, sin `.cd-orden-activa__direccion`, sin `app-priority-chip`.

- [ ] **Step 3: Verlos fallar.** Expected: FAIL porque los módulos no existen.

- [ ] **Step 4: Implementar.**
  - `puedePagarVisita` y `accionOtCliente` copian exactamente la lógica de `seguimiento-ot.page.ts:165-187`; los `computed` de Seguimiento pasan a llamarlas (con `null`/`false` sin OT).
  - La tarjeta es standalone, `OnPush`, sin servicios. CSS `.cd-orden-activa`: superficie `--cd-surface`, borde 1 px `--cd-action`, radio `--cd-radius-card`, padding 1rem, margen inferior 0.75rem.
  - `DESIGN.md` §5, fila nueva: «Orden activa | `cd-orden-activa`, `shared/ui/orden-activa` | una por panel; estado en grande y un solo botón relleno».

- [ ] **Step 5: Verlos pasar**, incluidas las specs de `seguimiento-ot` sin cambios, y `npm run ui:check`.

- [ ] **Step 6: Commit** `feat(mobile): tarjeta de orden activa y reglas compartidas`.

---

### Task 2: Panel del cliente

**Files:**
- Modify: `pages/panel-cliente/panel-cliente.page.ts` y `.spec.ts`, `../styles/pantallas.css`

**Interfaces (Consumes):** Task 1; `esOtActiva` de `@core/service/ots-cliente`.
**Produces:** `computed` `activa: OtResponse | null`, `otras: OtResponse[]`, `historial: OtResponse[]`.

Reglas:
- `activa`: entre las `esOtActiva`, la primera con acción `'pagar-visita'`; si no, la primera con `'presupuesto'`; si no, la de `fechaCreacion` más reciente (sin fecha, al final). Una `DISPUTADA` nunca cuenta como que pide acción.
- `otras`: las demás activas. `historial`: las no activas.
- Botón de la tarjeta: `Pagar la visita` → `/cliente/ot/{id}`; `Revisar presupuesto` → `/cliente/ot/{id}/diagnostico`; resto (incluida disputa) `Ver seguimiento` → `/cliente/ot/{id}`.
- Tarjeta: `estado` = `tituloEstadoOt`, `contexto` = `[tecnicoNombre]` si existe, `direccion` = `direccion || barrio`, `prioridad` = `prioridad ?? 'MEDIA'` (DESIGN §5, regla de tarjeta de orden).

- [ ] **Step 1: Tests que fallan:**

| Test | Aserciones |
|---|---|
| `la que pide pagar va grande` | con `EN_CAMINO`, `EN_DIAGNOSTICO`+diagnóstico y `ASIGNADA` sin pagar: botón = `Pagar la visita`; al tocarlo navega a `/cliente/ot/<la asignada>` |
| `después, la del presupuesto` | sin la de pago: `Revisar presupuesto`; navega a `/cliente/ot/<id>/diagnostico` |
| `sin acciones, la más reciente` | dos `EN_CAMINO` con fechas distintas: la tarjeta muestra el código de la nueva, aunque llegue segunda |
| `disputa no invita a pagar` | solo `DISPUTADA`: `Ver seguimiento` |
| `reparte otras e historial` | con `otsDeEjemplo()`: 1 `orden-activa`, 1 `panel-ot`, 2 `panel-historial-ot` |
| `el historial empieza plegado` | `[data-testid="panel-historial"]` contiene `Historial (2)`; el `ion-accordion-group` no tiene `value` |
| `con orden activa el pie va sin relleno` | `panel-solicitar` tiene `fill` = `outline`; sin activas, `solid` |
| `solo historial no muestra vacío` | solo `FINALIZADA`: sin `panel-vacio`, con `panel-historial` |
| `un refresco cambia la grande` | primer sondeo `EN_CAMINO`, segundo añade una `ASIGNADA` sin pagar: botón pasa a `Pagar la visita` |
| `sin ruido` | no existen `panel-filtros`, `panel-equipos`, `panel-total-activas` ni el texto `Pide un servicio y sigue` |
| `prioridad en la tarjeta y en las otras` | se conserva el test del chip (`Alta`, `Media`) |

Se borran o reescriben las pruebas de contadores, vistas del filtro, control segmentado, estado vacío por vista, `panel-ot-ver` e «Historial»: la spec quita esos elementos. La de lista vacía ahora exige `Aún no tienes servicios`.

- [ ] **Step 2: Verlos fallar.** Expected: FAIL por `orden-activa` inexistente.

- [ ] **Step 3: Implementar.**
  - Orden: sin cambios en carga, error y sin perfil; luego tarjeta, `h2` «Otras órdenes», historial.
  - Cada orden compacta es `button.cd-ot` (código, categoría, chip de prioridad, chip de estado, dirección) que navega al seguimiento; `data-testid` `panel-ot` o `panel-historial-ot`.
  - Historial: `ion-accordion-group` como en `liquidaciones-tecnico`, encabezado `Historial (N)`; no se pinta si N es 0.
  - Vacío (ninguna orden): título `Aún no tienes servicios`, texto `Pide un técnico y aquí verás en qué va.`
  - Quitar `heroNota` y `[subtitulo]`, segmento, contadores, botón Historial y sus miembros e imports. `OPCIONES_FILTRO_OTS` y compañía quedan en core (los usa la web).
  - Borrar de `pantallas.css` `cd-panel__sub`, `cd-panel__resumen`, `cd-filtros--cliente`, `cd-panel-ot*` solo si la búsqueda confirma que nadie más los usa; conservar `cd-panel-content`.

- [ ] **Step 4: Verlos pasar** y `npm run ui:check`.

- [ ] **Step 5: Commit** `feat(mobile): panel del cliente con la orden activa primero`.

---

### Task 3: Panel del técnico

**Files:**
- Modify: `pages/panel-tecnico/panel-tecnico.page.{ts,html,spec.ts}`, `../styles/pantallas.css`

**Interfaces (Consumes):** `OrdenActivaComponent` (Task 1); `otActiva`, `restoOts` ya existen.
**Produces:** `refrescar(evento: RefresherCustomEvent): void`.

Orden del contenido: avisos → carga/error → tarjeta activa → «Tu estado» → ofertas → vacío → «Otras órdenes».
Avisos, en este orden: validación rechazada o pendiente; `bloqueado-liquidacion`; `ubicacion-motivo` (su «Reintentar» pasa a `fill="outline"`); `aviso-ubicacion-apagada` con el texto `Apagada: no recibes ofertas.` solo si `otActiva()` y `modoUbicacion() === 'apagada'`.
Tarjeta: `estado` = `etiquetaEstado`, `contexto` = `clienteNombre` y `barrio` que existan, `accion` = `Abrir ejecución`, sin `prioridad`.

- [ ] **Step 1: Tests que fallan** (el orden se compara con `compareDocumentPosition`):

| Test | Aserciones |
|---|---|
| `con orden activa, la tarjeta va antes de Tu estado` | `orden-activa` precede a `.cd-estado`; su botón navega a `['/tecnico/ejecucion','ot1']` |
| `sin orden activa, Tu estado va primero` | `.cd-estado` precede a `ots-vacio`; sin `orden-activa` |
| `el bloqueo por liquidación queda arriba` | `BLOQUEADO_POR_LIQUIDACION` con orden: `bloqueado-liquidacion` precede a `orden-activa`; sin chips de disponibilidad |
| `el error de ubicación queda arriba` | con `motivo`: `ubicacion-motivo` precede a `orden-activa` |
| `aviso de ubicación apagada` | existe con orden y modo `apagada`; no existe sin orden ni en modo `compartiendo` |
| `las otras órdenes van después de las ofertas` | con dos órdenes y una oferta: `ofertas-activas` precede a `ot-ot2` |
| `deslizar actualiza y cierra el indicador` | `refrescar` vuelve a llamar `getMisOts` y `getOfertasParaTecnico`, y llama `complete()` |
| `si el refresco falla, conserva la lista` | segundo `getMisOts` con error: `complete()` llamado y sigue `orden-activa` |

Se reescribe `destaca la primera orden como activa…`: la tarjeta deja de ser un botón y el que navega es `orden-activa-accion`. Siguen `Orden de trabajo activa` como encabezado y los `data-testid` `ot-<id>` en las otras.

- [ ] **Step 2: Verlos fallar.**

- [ ] **Step 3: Implementar.** `ion-refresher slot="fixed"` con los textos del panel del cliente; `cargarOts(inicial, alTerminar?)` llama `alTerminar` en éxito y error. Borrar `cd-ot--activa` y `cd-activa__*` del CSS tras confirmar que no tienen otro uso.

- [ ] **Step 4: Verlos pasar** y `npm run ui:check`.

- [ ] **Step 5: Commit** `feat(mobile): panel del tecnico con la orden activa primero`.

---

### Task 4: Documentos, verificación y APK

**Files:** `DESIGN.md` §0.1, `docs/design/NAVEGACION.md` §3

- [ ] **Step 1:** `DESIGN.md` §0.1, bajo la nota de Seguimiento: «Para los **paneles** de cliente y técnico, la referencia de estructura es `docs/superpowers/specs/2026-11-27-rediseno-paneles-design.md` (2026-11-27, aprobado por el dueño), no los prototipos a4 y b0.»
- [ ] **Step 2:** `NAVEGACION.md`: actualizar las filas de `panel-cliente` y `panel-tecnico` de §3 (el técnico gana refresco) y cualquier mención al filtro o a «Historial» (búsqueda por `panel-cliente`).
- [ ] **Step 3:** `npm run ui:check`, `npm run mobile:test`, `npm run mobile:build`. Expected: los tres verdes; pega las salidas.
- [ ] **Step 4: Commit** `docs(diseno): paneles con la orden activa primero`.
- [ ] **Step 5: APK.** Confirmar que `MOBILE_API_ORIGIN` de `.env` es el de producción; `npm run mobile:apk`. Si falla con «gradlew.bat no se reconoce», desde `android/`: `JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew assembleDebug`. Expected: `android/app/build/outputs/apk/debug/app-debug.apk` con fecha nueva.

**Sin verificar al terminar:** aspecto a 320–768 px y en teléfono real; lo revisa el dueño con el APK.
