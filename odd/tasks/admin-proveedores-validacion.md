# Feature: admin-proveedores-validacion

## Objective
Sacar del panel de admin el **alta de proveedores** (que ya existe como auto-registro público) y dejar ahí lo que sí es trabajo de admin: la **validación documental** del proveedor. El admin deja de duplicar el registro y pasa a decidir si un proveedor puede operar.

## Problem (mapeo verificado 2026-10-22)
- `proveedores-admin-page.ts:31-49` define un formulario completo de alta y `crear()` (`:56`) lo manda por `AdminApi.crearProveedor` → `POST /api/proveedores`.
- **Ese endpoint es el auto-registro público**: `ProveedorController` documenta que `POST /api/proveedores` es `permitAll`, igual que `POST /api/clientes` y `POST /api/tecnicos`, y el rol lo deriva el servidor (`RegistrarProveedorUseCase`). La UI pública ya lo usa: `registro-page.ts` llama a `ProveedoresApi.registrar` (`proveedores-api.ts:47-58`).
- Conclusión: el formulario del admin **duplica** el alta pública, con un endpoint que no es de admin.
- En cambio, la **validación** existe en el backend y nadie la usa en la UI:
  - `GET /api/proveedores/{id}/documentos` (admin o dueño) → `ProveedoresApi.getDocumentos` (`proveedores-api.ts:99`).
  - `PATCH /api/proveedores/{id}/validacion` (solo `ADMINISTRADOR`) → `ProveedoresApi.validarDocumentacion` (`proveedores-api.ts:113`).
  - `ProveedorResponse` ya trae `estadoValidacion` (`ProveedorResponse.java:20-22`, expuesto en `common.models.ts:268`) — y la página hoy **no lo muestra** (solo el badge `activo`, `proveedores-admin-page.html:47`).

## Scope
- **T1 (frontend, S):** el panel de admin deja de crear proveedores y pasa a validar.
  - **Quitar** el formulario de alta (`form`, `campos`, `crear()`, `enviando`) de `proveedores-admin-page.ts` y `.html`.
  - **Mantener** el listado, ahora con el badge de `estadoValidacion` (`PENDIENTE` / `APROBADO` / `RECHAZADO`) además de `activo`.
  - **Agregar** aprobar / rechazar por proveedor con `ProveedoresApi.validarDocumentacion(id, 'APROBAR' | 'RECHAZAR', motivo?)`; en rechazo, pedir motivo (mismo patrón que `validacion-tecnicos-page.ts:67`).
  - **Quitar** `AdminApi.crearProveedor` + su spec (queda muerto al no usarlo nadie más; `ProveedoresApi.registrar` conserva el alta pública).
  - Aviso en la cabecera: los proveedores se registran desde `/registro` y el admin solo valida.
  - Nuevo `proveedores-admin-page.spec.ts`: no hay formulario; aprobar llama al API con `APROBAR`; rechazar sin motivo no llama; el listado muestra el estado.

## Out of scope
- Tocar `POST /api/proveedores` en el backend (sigue siendo el auto-registro público; está bien).
- La UI pública de registro (`registro-page`), que ya funciona.
- Subir/adjuntar archivos de documentos (el backend es metadata-only).
- Pedir los documentos de cada proveedor al expandir la fila (`getDocumentos` ya existe, pero el listado no lo necesita para aprobar; si se quiere revisar antes de decidir, es un follow-up).

## Constraints
- Frontend: copy y comentarios en **español**.
- TDD standard. Runner: `cd frontend && npm test -- --watch=false` (baseline 73 archivos / 653 tests), `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx eslint <tocados>` (8 errores preexistentes, no tocar).
- Sin backend, sin dependencias nuevas.
- Un writer, una rama `feat/admin-proveedores-validacion` desde `main`.
- Push / PR / merge: decisión del usuario.

## Authorized scope
Usuario (2026-10-22): *"dale arranca con esos 2"* — los dos baratos del roadmap (`docs/pendientes.md` §2.2 y §2.3).

## Acceptance criteria
- [x] T1: el panel de admin ya no tiene formulario de alta; el listado muestra `estadoValidacion`; aprobar y rechazar llaman al endpoint de validación con el motivo cuando corresponde; `AdminApi.crearProveedor` ya no existe; suite + tsc + eslint verdes.
  Evidence: commit `c40f1ee` (4 archivos, +244/−80). Fuera el `<form>` de alta y en el TS `campos`/`form`/`enviando`/`crear()`; el listado ahora muestra el badge `estadoValidacion` (emerald/amber/rose) además de `activo`, con "Validado" discreto cuando ya está `APROBADO` y par aprobar/rechazar para `PENDIENTE`/`RECHAZADO`. Aprobar llama `ProveedoresApi.validarDocumentacion(id,'APROBAR')`; rechazar exige motivo (`minLength 5`) en un modal calcado de `validacion-tecnicos-page`, y manda `'RECHAZAR'` + motivo. Errores 409/404 con copy propia vía `mensajeErrorAccion`; en error no recarga. `AdminApi.crearProveedor` eliminado (sin consumidores; `admin-api.spec.ts` no lo cubría) y su import muerto `ProveedorRequest`; `MockDbService.crearProveedor` se queda porque `ProveedoresApi.registrar` lo usa. Nuevo `proveedores-admin-page.spec.ts` (8 tests). **Frontend 74 archivos / 661 tests / 0 fallos** (+8 desde 653 — esta rama sale de `origin/main`, sin el commit del filtro), `tsc` app+spec 0, `eslint` 0 en los tocados. Parent spot check: suite re-corrida, 661/0 confirmado.

## Tasks
- [x] T1 (frontend, delegated): quitar el alta + validación documental + spec. Route: delegated-direct (3+ archivos no triviales).

## Progress
- 2026-10-22: doc creado tras el mapeo (con `path:line` del problema).
- 2026-10-22: T1 DONE (`c40f1ee`). Verificación del writer + spot check del parent: 74/661/0, `tsc` app+spec 0, `eslint` 0. Resta push + PR.
- Nota: en modo mock `ProveedoresApi.validarDocumentacion` es un no-op documentado, así que validar en mocks no cambia el badge hasta recargar con backend real. No es un bug de la página.

## Delivery
- Forecast: ~120–200 líneas netas (se borra el formulario y se agregan las acciones + spec). Un PR, sin cadena.
