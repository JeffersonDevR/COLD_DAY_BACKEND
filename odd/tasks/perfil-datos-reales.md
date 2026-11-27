# Feature: perfil-datos-reales

## Objective
Adaptar la idea de "User Profile & Stats Screen" de MobileLayout Studio a la pantalla real de Mi cuenta del móvil: cabecera de identidad + barra de 3 columnas de estadísticas alimentada por datos reales de los tres roles (cliente, técnico, proveedor). Sin persona ficticia, métricas inventadas, bio falsa ni segmento Instagram de grid/guardados/corazones.

## Problem
La pantalla Mi cuenta muestra la identidad de la sesión, pero no ofrece un resumen de la actividad real del perfil. El prototipo de referencia propone una cabecera con foto, nombre y una franja de métricas; esa idea debe aterrizarse sobre los servicios y modelos que ya existen, no sobre un mockup decorativo.

## Why
El producto opera con "el registro es la verdad" y "estados honestos" (PRODUCT.md §Product Principles, DESIGN.md §1): toda cifra visible debe rastrearse a un dato real. Mostrar un persona de ejemplo o contadores inventados violaría la regla de no fabricar métricas (DESIGN.md §7 / PRODUCT.md Absences).

## Scope
- T1 — Documento ODD (este archivo), sin `git add`.
- T2 — `cuenta.page.ts`: identidad con `ion-avatar`, `fotoUrl` real, píldora de estado con dato real y barra de stats por rol.
- T3 — `pantallas.css`: estilos del avatar y de la barra de 3 columnas con tokens `--cd-*`.
- T4 — `cuenta.page.spec.ts`: mocks de los servicios nuevos y 4 specs enfocadas.
- T5 — Verificación (`ui:check`, specs móvil, typecheck) y commit de trabajo.

Fuera de alcance: archivos web, `ui-rules.baseline.json`, la pantalla `agregar-perfil-page.html` (WIP ajeno), backend,dependencias y cualquier refactor no pedido.

## Constraints
- Route = `delegated direct`. Trigger: el mapeo de 4 archivos ya se disparó + regla de writer (2+ archivos no triviales). Un único writer en el worktree.
- TDD = `strict_tdd: false`. Fuente: configuración existente del proyecto en `odd/tasks/coherencia-ordenes-perfiles.md` (línea 22; a su vez Engram `sdd/cold_day_backend/testing-capabilities`). Verificación funcional ordinaria, sin ciclo RED/GREEN obligatorio.
- Cambio mínimo: solo los 3 archivos fuente + este doc. `git add` explícito de los 3 fuentes; el doc queda untracked.
- Copy en tuteo, español de Colombia; sin voseo (`usá`, `revisá`, `guardá`, `enviá`, `creá`, `elegí`, `pedí`, `completá`, `iniciá`).
- CSS sin hex nuevo, blur, gradiente, `dark:` ni `env()` directo; solo tokens `--cd-*`.
- No tocar techos de baseline. `ui:check` ya está en rojo por UI-L1 web 20 > 19 (WIP ajeno): no corregir.
- committer con Conventional Commit en español, sin Co-Authored-By ni atribución IA.

## Tasks (checklist accionable)
- [x] **T1** Crear `odd/tasks/perfil-datos-reales.md` + espejo en Engram (`odd/perfil-datos-reales/tasks`, obs 251; 3 conflict candidates resueltos `not_conflict`).
- [x] **T2** `cuenta.page.ts`: avatar con `fotoUrl()`/`inicial()`, chip de estado real, stats por rol, skeleton de carga, recarga por `effect()` con `takeUntilDestroyed` y `untracked` para evitar ciclos.
- [x] **T3** `pantallas.css`: `.cd-cuenta__avatar`, `.cd-cuenta__stats`, `.cd-cuenta__stat strong` con tokens; se quitó el gradiente previo (UI-D3 mobile 1→0).
- [x] **T4** `cuenta.page.spec.ts`: mocks por defecto + 5 specs (cliente, técnico, proveedor, sin mockup y error sin cifras).
- [x] **T5** Verificación + commit `860e897` `feat(mobile): mostrar perfil con datos reales por rol`.

## Acceptance criteria
- [x] El bloque de identidad conserva `data-testid="cuenta-nombre"`, `cuenta-correo`, selector de modos, formulario de solicitud y logout intactos.
- [x] `fotoUrl()` sale de `usuario()?.fotoUrl`; si no hay foto se muestra `inicial()` con `aria-hidden`.
- [x] Cliente → 'Cuenta activa'; Técnico → etiqueta de `estadoOperativo`; Proveedor → etiqueta de `estadoValidacion`, con tono de chip por valor real.
- [x] Stats solo con `stats().length > 0`; en carga se muestra `cd-skeleton` con `testId="cuenta-perfil-cargando"`; en error no se inventan cifras (spec dedicada).
- [x] Cliente: `En curso` / `Concluidos` / `Sin técnico` desde `getOtsPorCliente` + helpers de `@core/service/ots-cliente`.
- [x] Técnico: `Servicios` / `Reputación` / `Especialidades` desde `getMiPerfil()`; `—` si el valor real es null/undefined.
- [x] Proveedor: `Documentos` / `Solicitudes` / `Validación` desde `ProveedorRegistroService`, `getMisDocumentos()` y `getMisSolicitudes()`.
- [x] Ninguna cadena de mockup ('Sarah Jenkins', 'Followers', 'Following', 'Senior Product Designer') en el bloque (spec dedicada).
- [x] `ui:check`: ninguna cuenta mobile ni web sube respecto del baseline (web UI-L1 20 > 19 es pre-existente; UI-D3 mobile bajó 1→0).
- [x] Specs móvil en verde (334/334); typecheck del proyecto mobile sin errores nuevos.

## Applicable checks
- `cd frontend && npm run ui:check` (antes y después).
- `cd frontend && npx ng test mobile --watch=false` (directo: `npm run mobile:test` dispara el prehook `ui:check`, hoy rojo por WIP ajeno).
- Typecheck con el tsconfig del proyecto mobile (`npx tsc -p projects/mobile/tsconfig.app.json --noEmit` o el que defina `angular.json`).
- No aplica `mobile:build`/`ui:audit` por el origen de red y el alcance de la tarea; se reporta como no verificado.

## Progress / verification evidence
- 2026-11-20 — T1 doc creado; espejo en Engram guardado.
- 2026-11-20 — Baseline `npm run ui:check`: `ui-rules: 1 regla(s) empeoraron`; `UI-L1 web 20 > techo 19 SUBIÓ`; mobile UI-T1/T2/C1/A1/A2/A3/D1/D2/D3/S1/L1/L2 todos `ok` en techo. Causa: `src/app/core/service/ots-cliente.ts` y `src/app/pages/agregar-perfil-page/agregar-perfil-page.html` (WIP ajeno). No corregido.
- 2026-11-20 — `npm run ui:check` post-cambio: misma única fila roja pre-existente (`UI-L1 web 20 > 19`, ARRIBA: 4 en `ots-cliente.ts` + `agregar-perfil-page.html`); `UI-D3 mobile 0/1 bajó` por quitar el gradiente del avatar. Ninguna cuenta mobile subió. `tokens 51 declarados / 370 usos`, `hex fuera de tokens 0/0`. `auditar-contraste.mjs --strict` pasó.
- 2026-11-20 — `npm run mobile:test`: FALLÓ en `premobile:test` por el `ui:check` pre-existente (web UI-L1 20 > 19), sin llegar a correr los specs; no se usó `--no-verify` ni se tocó el baseline.
- 2026-11-20 — `npx ng test mobile --watch=false`: `Test Files 33 passed (33)`, `Tests 334 passed (334)`, build de aplicación completado (12.034 s), duración 31.16 s. Solo advertencias NG8113 pre-existentes en `LiquidacionesTecnicoPage` / `SolicitudesProveedorPage` y ruido jsdom "Could not parse CSS stylesheet" (conocido, DESIGN §8.11).
- 2026-11-20 — `npx tsc -p projects/mobile/tsconfig.app.json --noEmit`: sin salida, exit 0.
- 2026-11-20 — Commit `860e897` en `feat/coherencia-ordenes-perfiles`: 3 archivos, 361 inserciones / 14 borrados. `git add` explícito de los 3 fuentes; `odd/tasks/perfil-datos-reales.md` quedó untracked. `core.hooksPath` vacío (sin hook pre-commit). No se tocó `frontend/scripts/ui-rules.baseline.json` ni archivos web.

## Next step
Cerrar la tarea y reportar al orquestador. Pendiente ajeno: el equipo debe bajar `UI-L1 web` de 20 a 19 en `ots-cliente.ts` / `agregar-perfil-page.html` para que `npm run mobile:test` y `mobile:build` dejen de quedar bloqueados por el prehook; no está en este alcance. Verificación visual en 320/360/390/430/768 px (`ui:audit`) no ejecutada: requiere backend + app locales.
