# Feature: errores-silenciosos-acciones

## Objective
Que ninguna acción iniciada por el usuario pueda fallar en silencio: hoy 15 acciones del frontend fallan sin toast ni cambio de estado, y la pantalla queda igual, así que el usuario cree que funcionó.

## Problem
Síntoma reportado: al aprobar un técnico, la lista lo sigue mostrando. La causa **no** es staleness — `validacion-tecnicos-page.ts` refetchea tras el éxito (`:35-42`). Es que los dos `subscribe` de acción (`:36` `aprobar`, `:52` `confirmarRechazo`) **no tienen handler de `error`**, y el backend responde **409** `DocumentacionIncompletaException` (`ValidarDocumentacionTecnicoUseCase:46`, `Tecnico.aprobarValidacion:94-98`, mapeada en `TecnicoControllerAdvice:94`) cuando falta documentación vigente. Resultado: sin toast, sin refetch, fila intacta.

El interceptor global solo muestra **401** (`core/interceptos/error.interceptor.ts:74-82`); todo lo demás (400/403/404/409/500/network) se re-lanza en silencio.

Barrido verificado (2026-10-16): **15 acciones en 8 archivos** sin handler de error.

## Scope
- Los 15 sitios de acción: ejecución de OT (×5), seguimiento (×1), diagnóstico (×2), validación de técnicos (×2), consignaciones admin (×2), liquidaciones técnico (×1), disputas admin (×1), perfil-documentos (×1).
- Un mecanismo para traducir el fallo a un mensaje humano en español. Opciones: reusar el patrón que ya existe en `solicitudes-proveedor-page.ts` (mapea 409/403/404 a copy humana) por archivo, o un helper chico compartido si resulta más chico. **El writer elige la opción más chica y lo justifica en el reporte.**
- Specs: del mecanismo + un test de camino de error por página tocada.

## Out of scope
- Los **LOADS** silenciosos (clase distinta, menor severidad) — listados en Follow-ups.
- Tocar el interceptor global (riesgo de doble toast en los sitios ya cubiertos).
- SSE: la validación de técnicos no está en su alcance por diseño (`sse-tiempo-real-ot.md`).

## Constraints
- Frontend-only; copy y comentarios en **español**; ponytail (el cambio completo más chico); sin mover archivos; sin dependencias nuevas.
- Mensajes: español humano, **nunca** un status code crudo, un stack ni un string interno.
- Los handlers de carga que hoy setean `[]`/null **no se tocan** en esta feature.
- Rama `fix/errores-silenciosos-acciones` (desde `origin/main` = `6dbc328`). Un solo PR. Push/merge son decisiones del usuario.
- TDD standard (`strict_tdd: false`). Runners: `npm test -- --watch=false` (**baseline de esta rama: 69 archivos / 547 tests** — el 583 del brief original era del worktree de T4, que ya tenía T3+T4 aplicados; tras T1: **70 / 555**), `npx tsc -p tsconfig.app.json --noEmit` (y `tsconfig.spec.json`), `npx eslint <archivos tocados>`; los 8 errores del lint repo-wide son preexistentes (no tocarlos).

## Authorized scope
Usuario autorizó "409 + barrido de la clase" (2026-10-16).

## Acceptance criteria
- [x] T1: mecanismo elegido + el caso confirmado (validación de técnicos) muestran un toast de error humano ante 409/404; spec cubre el camino de error. Evidence: commit `4d033c2` (4 archivos, +138/−5); helper `core/alertas/mensaje-error.ts` (`mensajeErrorAccion`, status→copy humana, sin filtrar strings internos); ambos subscribes de `validacion-tecnicos-page` con `error:`; la fila NO se refetchea al fallar y el modal de rechazo queda abierto con el motivo intacto; specs +8 (6 del helper, 2 de la página). Suite 70 archivos / 555 tests / 0 failures; `tsc` (app y spec) exit 0; `eslint` en lo tocado exit 0.
- [x] T2: los 13 sitios restantes muestran toast ante fallo; un test por página tocada; **ningún `subscribe` de acción queda sin `error:`**. Evidence: commit `1c1c19c` (14 archivos, +265/−24); suite 70 archivos / 565 tests / 0 failures (+10); `tsc` app+spec 0; `eslint` en lo tocado 0; verificación independiente PASS — confirmó los 13 handlers, que **ningún camino de error ejecuta el bloque de éxito**, y que los 6 modales/forms quedan abiertos con sus campos intactos.
- [x] T3: suite frontend verde + `tsc` + `eslint` en lo tocado + verificación independiente. Evidence: suite **70 archivos / 565 tests / 0 failures**; `tsc` app y spec exit 0; `eslint` sobre los **18 `.ts`** que toca el feature, exit 0; verificación independiente de T2: PASS; los 8 errores del lint repo-wide siguen siendo preexistentes.

## Tasks
- [x] T1 (frontend, delegated): mecanismo + validación de técnicos (2 sitios). Route: delegated-direct. Evidence: commit `4d033c2`; el writer eligió el **helper compartido** y lo justificó (el patrón por archivo de `solicitudes-proveedor-page` filtra el string interno del backend: `DocumentacionIncompletaException` emite un id de dominio). Copy del 409: "El expediente del técnico no está completo o tiene documentos vencidos. Pídele que actualice la documentación antes de validarlo."
- [x] T2 (frontend, delegated): los 13 sitios restantes (7 archivos). Route: delegated-direct + un ajuste de copy inline del parent (ver Progress). Evidence: commit `1c1c19c`; títulos por acción ("No se pudo iniciar el desplazamiento", "No se pudo resolver la disputa", …); un solo override de copy; el grep propio del verificador confirma **0 subscribes de acción sin `error:`**.
- [x] T3 (parent): verificación final + reporte. Hecho 2026-10-16: suite + typecheck (app y spec) + lint sobre el set completo de archivos tocados, más una verificación independiente. Resta publicar (push + PR) — decisión del usuario.

## Delivery
- Forecast ~150–200 líneas (15 handlers + mecanismo + specs) → bajo el presupuesto de ~400: **un solo PR, sin cadena**.

## Follow-ups (fuera de alcance)
- **Residual (encontrado por el verificador de T2):** 3 sitios siguen mostrando el **mensaje crudo del backend** al usuario — `seguimiento-ot-page.ts:275,295` y `panel-tecnico-page.ts:117` (misma clase de fuga que T1 eliminó, pero en caminos de carga).
- 3 caminos de error de `ejecucion-ot-page` sin test propio (el writer cubrió 2 de 5).
- Nota deliberada: 9 de los 10 tests de T2 usan `expect.any(String)` para el mensaje; el copy exacto está cubierto centralmente por los 6 tests del helper (T1), así que no se duplicó a propósito.
- LOADS silenciosos: `ot-carga.ts:42` (getOtById, página en blanco), `dashboard-admin-page.ts:56`, `diagnostico-ot-page.ts:85`, `pago-acta-page.ts:95`, `ejecucion-ot-page.ts:185`, `seguimiento-ot-page.ts:133`, `seguimiento-ot-page.ts:202` (poll de ubicación que muere sin avisar), y los que resetean a `[]`/null.
- SSE para eventos de cuenta (técnico validado / proveedor aprobado) si se quiere live cross-admin.
- `common.models.ts:14` incluye `EN_REVISION`, que el backend nunca emite.

## Progress
- 2026-10-16: doc creado en `fix/errores-silenciosos-acciones` (desde `origin/main` `6dbc328`). Barrido verificado: 15 acciones / 8 archivos.
- 2026-10-16: T1 DONE (commit `4d033c2`): helper compartido `core/alertas/mensaje-error.ts` (`mensajeErrorAccion`) + el caso confirmado. El writer probó empíricamente que el test sirve (comentó el handler → el test del 409 falló; restauró). **Corrección de baseline:** en esta rama el front arranca en 547 tests (el 583 del brief era del worktree de T4); el delta exacto del cambio es +8 (6 del helper + 2 de la página).
- 2026-10-16: T2 DONE (commit `1c1c19c`): los 13 sitios + 10 tests de camino de error. El writer probó empíricamente que un test sirve (quitó el handler de `iniciarDesplazamiento` → el test falló; restauró). Suite 70 / 565.
- 2026-10-16: verificación independiente de T2: PASS con un hallazgo menor **refutado**: el override del 409 de `iniciarDesplazamiento` ("el cliente no pagó la visita") desatribuye la causa cuando el `ASIGNADA` visible está viejo (otro actor ya canceló → el 409 real es `TransicionOtInvalida`). El parent lo corrigió **inline** ampliando el copy para cubrir ambas causas, con su spec. Sin blockers.
- 2026-10-16: T3 DONE (parent). Suite 70 / 565 / 0; `tsc` app+spec exit 0; `eslint` sobre los 18 `.ts` del feature exit 0. Rama lista para publicar: `fix/errores-silenciosos-acciones` (3 commits de trabajo + 2 de doc, sobre `origin/main` `6dbc328`).
