# Historial, espaciado y recarga Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Historial en un solo sitio y claro, aire bajo el saludo y deslizar para recargar en toda pantalla con datos remotos.

**Architecture:** La pestaña `equipos` pasa a listar órdenes; una directiva `ion-refresher[cdRecargar]` concentra completar el indicador y avisar el fallo, y cada pantalla aporta un `recargar(): Observable<unknown>` que solo cambia datos si la respuesta llega.

**Tech Stack:** Angular 21 zoneless, Ionic 9, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-observaciones-historial-recarga-design.md`

## Global Constraints

- Solo `frontend/projects/mobile/src/`, `DESIGN.md`, `docs/design/NAVEGACION.md`.
- Sin colores, fuentes ni radios nuevos; targets ≥44 px; `npm run ui:check` sin subir techos; tuteo.
- Aviso de fallo: `No pudimos actualizar`. Recargar nunca borra lo que se está escribiendo.

## Review Focus

1. Recargar con el servidor caído: indicador cerrado, datos intactos, aviso (Task 3).
2. Orden sin código, fecha ni dirección en Historial: se omite, nunca «undefined» (Task 1).
3. Escribir un diagnóstico y deslizar: el texto sigue (Task 4).
4. Perfil técnico con cambios sin guardar y deslizar: la selección sigue (Task 4).
5. Cliente con solo órdenes cerradas: el inicio no queda en blanco (Task 1).

---

### Task 1: Historial y su salida del inicio

**Files:** `app/pages/equipos/equipos.page.{ts,spec.ts}`, `app/pages/panel-cliente/panel-cliente.page.{ts,spec.ts}`, `app/shared/ui/priority-chip/priority-chip.component.ts`, `app/shared/ui/orden-activa/orden-activa.ts`, `app/modo/modo.ts`, `app/app.routes.ts` y su spec, `styles/pantallas.css`

**Interfaces (Produces):** `app-priority-chip` con input `conPalabra: boolean = false` («Prioridad media»); `cd-orden-activa` lo usa cuando recibe `prioridadConPalabra`.

- Historial: una tarjeta `data-testid="historial-ot"` por orden, de la más reciente a la más antigua (sin fecha al final): categoría, código, chip de estado, fecha, dirección o barrio, falla (2 líneas) y `ion-button` sin relleno «Revisar» (`historial-revisar`) a `/cliente/ot/{id}`. Prioridad solo si `esOtActiva`. Pie «Pedir un técnico». Vacío «Aún no tienes servicios». Marca y pestaña «Historial»; ruta sin cambios.
- Panel: sin historial plegado; sin activas, vacío «No tienes servicios en curso» (con «Los anteriores están en Historial.» si hay cerradas, si no «Pide un técnico y aquí verás en qué va.»).
- Tests: una tarjeta por orden aunque compartan categoría; orden por fecha; prioridad solo en activas y con la palabra; «Revisar» navega; sin conteos ni «Ver la última OT»; datos ausentes sin «undefined»; panel sin `panel-historial` y con el vacío correcto.

### Task 2: Aire bajo el saludo

`styles/pantallas.css`: `.cd-page .cd-hero { margin-bottom: 1rem; }`. Verificación: `ui:check` (CSS puro, sin test).

### Task 3: Directiva y listas

**Files:** Create `app/shared/recargar.ts` + spec; Modify Historial, ofertas-tecnico, solicitudes-proveedor, documentos-proveedor.

**Interfaces (Produces):** `RecargarDirective` (`ion-refresher[cdRecargar]`, input `cdRecargar: () => Observable<unknown>`); `ContenidoRecargaComponent` (`cd-recarga-contenido`, textos «Desliza para actualizar» / «Actualizando...»); en cada página `recargar`.

- Tests de la directiva: completa en éxito; completa y avisa en error; sin aviso si la sesión ya se notificó (lo cubre `avisarErrorAccion`).
- Por página: `recargar` trae datos nuevos y, si falla, conserva los visibles.

### Task 4: Detalles y perfil

**Files:** seguimiento-ot, ejecucion-ot, diagnostico, pago-acta, perfil-tecnico.

- Órdenes: `recargar` = `getOtById` y actualiza la OT (ejecución también insumos; seguimiento reevalúa sondeo y distancia).
- Perfil: actualiza el perfil; la selección y la cédula tecleada se conservan si `hayCambios()`.
- Cuenta queda fuera: no lee datos del servidor.

### Task 5: Documentos y verificación

`DESIGN.md` (§0.1 historial ya no sigue a10; §5 prioridad solo en activas y con la palabra; §5.1 recargar también en detalles), `NAVEGACION.md`. `ui:check`, `mobile:test`, `mobile:build`.

Un commit por tarea.
