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
- TDD standard (`strict_tdd: false`). Runners: `npm test -- --watch=false` (baseline **69 archivos / 583 tests**), `npx tsc -p tsconfig.app.json --noEmit`, `npx eslint <archivos tocados>`; los 8 errores del lint repo-wide son preexistentes (no tocarlos).

## Authorized scope
Usuario autorizó "409 + barrido de la clase" (2026-10-16).

## Acceptance criteria
- [ ] T1: mecanismo elegido + el caso confirmado (validación de técnicos) muestran un toast de error humano ante 409/404; spec cubre el camino de error.
- [ ] T2: los 13 sitios restantes muestran toast ante fallo; un test por página tocada; **ningún `subscribe` de acción queda sin `error:`**.
- [ ] T3: suite frontend verde + `tsc` + `eslint` en lo tocado + verificación independiente.

## Tasks
- [ ] T1 (frontend, delegated): mecanismo + validación de técnicos (2 sitios). Route: delegated-direct.
- [ ] T2 (frontend, delegated): los 13 sitios restantes (7 archivos). Route: delegated-direct.
- [ ] T3 (parent): verificación final + reporte.

## Delivery
- Forecast ~150–200 líneas (15 handlers + mecanismo + specs) → bajo el presupuesto de ~400: **un solo PR, sin cadena**.

## Follow-ups (fuera de alcance)
- LOADS silenciosos: `ot-carga.ts:42` (getOtById, página en blanco), `dashboard-admin-page.ts:56`, `diagnostico-ot-page.ts:85`, `pago-acta-page.ts:95`, `ejecucion-ot-page.ts:185`, `seguimiento-ot-page.ts:133`, `seguimiento-ot-page.ts:202` (poll de ubicación que muere sin avisar), y los que resetean a `[]`/null.
- SSE para eventos de cuenta (técnico validado / proveedor aprobado) si se quiere live cross-admin.
- `common.models.ts:14` incluye `EN_REVISION`, que el backend nunca emite.

## Progress
- 2026-10-16: doc creado en `fix/errores-silenciosos-acciones` (desde `origin/main` `6dbc328`). Barrido verificado: 15 acciones / 8 archivos.
