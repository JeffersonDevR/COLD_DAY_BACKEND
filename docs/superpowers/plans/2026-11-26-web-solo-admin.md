# Web solo como panel admin: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La web queda con login, recuperar contraseña y pantallas internas; todo lo de cliente, técnico y proveedor sale.

**Architecture:** Poda en el mismo proyecto Angular (`frontend/src`). Primero se agregan las dos pantallas que hacen falta, luego se cambian las redirecciones y al final se borra. `@core/*` sigue donde está y la app móvil no se toca.

**Tech Stack:** Angular 21 (standalone, signals, OnPush), PrimeNG 21, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-web-solo-admin-design.md`

## Global Constraints

- Todos los comandos se corren desde `frontend/`.
- Sin cambios en `backend/` ni en `frontend/projects/mobile`.
- No tocar `frontend/.env`.
- Copy en tuteo, español de Colombia. Leer `DESIGN.md` completo antes de la tarea 1.
- Los techos de `npm run ui:check` no suben. Si bajan, `npm run ui:update`.
- Sin `it.skip` ni `eslint-disable`. Un spec solo cambia si cambia el comportamiento o desaparece el código.
- `core/service/solicitudes-perfil-api.ts` se conserva.
- Rama `refactor/web-solo-admin`. Una tarea = un commit; los commits requieren el visto bueno del dueño (`AGENTS.md`).
- Antes de empezar: correr `npm run ui:check` y `npx ng test --watch=false` y guardar la salida como línea base.

## Review Focus

1. Preferencia guardada `coldday.panel.preferido = /cliente/panel` en un admin: debe ir a `/admin/dashboard` (tarea 3).
2. Marcador a una ruta retirada (`/cliente/panel`) con sesión no interna: acaba en `/usa-la-app`, sin bucle (tareas 3 y 4).
3. `CONTABLE` abre `/admin/ot/:id` y la API responde 403: aviso con reintento, nunca en blanco (tarea 2).
4. El historial falla pero la OT carga: se ve la OT (tarea 2).
5. OT sin técnico ni presupuesto: texto explícito, no huecos ni `undefined` (tarea 2).

---

### Task 1: Pantalla `/usa-la-app`

**Files:**
- Create: `src/app/pages/usa-la-app-page/usa-la-app-page.ts` (+ `.html`, `.spec.ts`)
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `AuthService.logout(): void` (ya navega a `/login`).
- Produces: componente `UsaLaAppPage`; ruta `usa-la-app` con `canActivate: [authGuard]`, título `Usa la app - COLD DAY`.

- [ ] **Step 1: Spec que falla**

```ts
it('explica que la cuenta se usa desde la app', () => {
  expect(texto).toContain('Usa la app de Cold Day');
  expect(texto).toContain('Esta web es solo para el equipo interno.');
});
it('cierra la sesión desde el botón', () => {
  boton.click(); // "Cerrar sesión"
  expect(auth.logout).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2:** `npx ng test app --watch=false --include src/app/pages/usa-la-app-page/*.spec.ts` → FALLA (no existe).
- [ ] **Step 3:** Crear el componente y la ruta. Título `Usa la app de Cold Day`; cuerpo `Tu cuenta funciona en la app móvil. Esta web es solo para el equipo interno.`; botón `Cerrar sesión`. Sin enlace de descarga (no hay URL publicada).
- [ ] **Step 4:** Mismo comando → PASA.
- [ ] **Step 5:** Commit `feat(web): pantalla para cuentas que solo usan la app`.

### Task 2: Detalle de OT de solo lectura

**Files:**
- Create: `src/app/pages/admin-ot-detalle-page/admin-ot-detalle-page.ts` (+ `.html`, `.spec.ts`)
- Modify: `src/app/app.routes.ts`, `src/app/pages/monitoreo-ot-page/monitoreo-ot-page.html:109`, `monitoreo-ot-page.spec.ts`

**Interfaces:**
- Consumes: `cargarOtDesdeRuta(route, otApi, onId, onOt): CargaOtEstado` (`core/service/ot-carga`); `OtApi.getHistorial(id): Observable<HistorialOtItem[]>`; `OtTimeline` (inputs `estadoActual`, `historial`); `EstadoBadge`; `CargaError` (input `mensaje`, output `reintentar`).
- Produces: componente `AdminOtDetallePage`; ruta `admin/ot/:id` con `canActivate: [authGuard, roleGuard(['ADMINISTRADOR', 'CONTABLE'])]`, título `Detalle de OT - COLD DAY`.

- [ ] **Step 1: Specs que fallan** (con `OtApi` simulado y `:id = ot-1`)

```ts
it('muestra código, cliente, técnico, descripción y total', () => {
  for (const t of ['OT-2026-0001', 'Ana Cliente', 'Luis Técnico', 'No enfría', '150.000']) {
    expect(texto).toContain(t);
  }
});
it('sin técnico ni presupuesto lo dice', () => {
  expect(texto).toContain('Sin técnico asignado');
  expect(texto).toContain('Sin presupuesto');
  expect(texto).not.toContain('undefined');
});
it('si la OT responde 403 muestra el aviso con reintento', () => {
  expect(el.querySelector('app-carga-error')).not.toBeNull();
});
it('si falla solo el historial, igual muestra la OT', () => {
  expect(texto).toContain('OT-2026-0001');
  expect(texto).toContain('No pudimos cargar el historial.');
});
it('no ofrece acciones sobre la OT', () => {
  expect(el.querySelectorAll('form, input, textarea').length).toBe(0);
});
```

Y en `monitoreo-ot-page.spec.ts`:

```ts
it('el detalle abre la vista admin', () => {
  expect(enlaceDetalle.getAttribute('href')).toBe('/admin/ot/ot-1');
});
```

- [ ] **Step 2:** `npx ng test app --watch=false --include src/app/pages/{admin-ot-detalle,monitoreo-ot}-page/*.spec.ts` → FALLA.
- [ ] **Step 3:** Implementar. Campos: `codigo || 'Sin código'`, estado, categoría, `clienteNombre`, `tecnicoNombre || 'Sin técnico asignado'`, `barrio || direccion`, `descripcionFalla`, `presupuesto` (total, mano de obra, repuestos, aprobado) o `Sin presupuesto`, fecha de creación, timeline. Enlace de vuelta a `/admin/monitoreo`. Sin mapa, sin botones de acción, sin modo mock especial. Cambiar el `routerLink` de monitoreo a `['/admin/ot', ot.id]`.
- [ ] **Step 4:** Mismo comando → PASA.
- [ ] **Step 5:** Commit `feat(web): detalle de OT de solo lectura para administración`.

### Task 3: Redirecciones, menú y login

**Files:**
- Modify: `src/app/core/navihationError/panel-resolver.ts`, `src/app/core/service/auth.service.ts:227-241`, `src/app/shared/app.menu.ts`, `src/app/shared/app-sidebar/app-sidebar.ts`, `src/app/pages/login-page/login-page.html:141-146`
- Test: `panel-resolver.spec.ts`, `panel-redirect.spec.ts`, `auth.service.spec.ts`, `app.menu.spec.ts`, `app-sidebar.spec.ts`, `app-topbar.spec.ts`, `login-page.spec.ts`

**Interfaces:**
- Consumes: ruta `usa-la-app` (tarea 1).
- Produces: `rutaDePanel(rol)` devuelve `/admin/dashboard` para `ADMINISTRADOR` y `CONTABLE`, `null` para el resto. `resolverPanel(...)` devuelve `/usa-la-app` cuando ningún rol tiene panel. `buildMenu(roles: Iterable<Rol> | null): MenuSection[]` (desaparecen `rutaPanelPropio` y `panelPropio`).

- [ ] **Step 1: Cambiar los specs primero**

```ts
// panel-resolver
localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/cliente/panel');
expect(resolverPanel('ADMINISTRADOR', new Set<Rol>(['ADMINISTRADOR']))).toBe('/admin/dashboard');
expect(resolverPanel('CLIENTE', new Set<Rol>(['CLIENTE']))).toBe('/usa-la-app');
expect([...RUTAS_PANEL]).toEqual(['/admin/dashboard']);
// auth.service
for (const rol of ['CLIENTE', 'TECNICO', 'PROVEEDOR'] as Rol[]) {
  expect(service.getDashboardRouteForRole(rol)).toBe('/usa-la-app');
}
// app.menu
expect(buildMenu(new Set<Rol>(['CLIENTE', 'TECNICO', 'PROVEEDOR']))).toEqual([]);
expect(buildMenu(new Set<Rol>(['CONTABLE']))[0].items.map(i => i.routerLink))
  .toEqual(['/admin/dashboard', '/admin/consignaciones', '/admin/monitoreo']);
// login-page
expect(el.querySelector('a[href="/registro"]')).toBeNull();
expect(el.querySelector('a[href="/recuperar"]')).not.toBeNull(); // ya existe: no se pierde
```

Los casos de specs sobre menús y paneles de cliente, técnico y proveedor se eliminan.

- [ ] **Step 2:** `npx ng test app --watch=false` → FALLAN esos specs.
- [ ] **Step 3:** Implementar. En `app.menu.ts` queda solo la sección `Administración` (se va también `COMISION`). En login se quita el párrafo "¿No tienes una cuenta aún?". El enlace a `/recuperar` se queda.
- [ ] **Step 4:** `npx ng test app --watch=false` → PASA.
- [ ] **Step 5:** Commit `refactor(web): redirecciones y menú solo para roles internos`.

### Task 4: Borrar las pantallas retiradas

**Files:**
- Modify: `src/app/app.routes.ts`, `src/app/app.config.ts` (quitar el inicializador de `MapaConfigService`)
- Delete: en `src/app/pages/`: `registro-page`, `agregar-perfil-page`, `panel-cliente-page`, `solicitar-servicio-page`, `seguimiento-ot-page`, `diagnostico-ot-page`, `pago-acta-page`, `calificar-servicio-page`, `historial-equipos-page`, `panel-tecnico-page`, `mi-perfil-tecnico-page`, `ofertas-page`, `ejecucion-ot-page`, `perfil-documentos-page`, `liquidaciones-tecnico-page`, `solicitudes-proveedor-page`, `documentos-proveedor-page`
- Delete: en `src/app/shared/`: `cargo-visita`, `empty-state`, `loader`, `mapa-radar`, `mapa-seguimiento`, `modalMessage`, `selector-ubicacion-mapa`
- Delete: `src/app/core/environment/comision-plataforma.ts`, `src/app/core/service/polyline-ruta.ts` (y sus specs)
- Create: `src/app/app.routes.spec.ts`

**Interfaces:**
- Consumes: rutas de las tareas 1 y 2.
- Produces: tabla de rutas final.

- [ ] **Step 1: Spec que falla**

```ts
it('la web solo expone acceso y administración', () => {
  expect(routes.map(r => r.path)).toEqual([
    '', 'login', 'recuperar', 'panel', 'usa-la-app',
    'admin/dashboard', 'admin/validacion-tecnicos', 'admin/consignaciones',
    'admin/disputas', 'admin/monitoreo', 'admin/ot/:id', 'admin/proveedores', '**',
  ]);
});
```

- [ ] **Step 2:** `npx ng test app --watch=false --include src/app/app.routes.spec.ts` → FALLA.
- [ ] **Step 3:** Dejar las rutas en ese orden. Antes de borrar cada archivo de `shared/` y `core/`, buscar su nombre en `src/` y `projects/mobile/src`; si algo vivo lo importa, conservarlo y reportarlo. `ot-timeline` se queda.
- [ ] **Step 4:** `npx ng build && npx ng test --watch=false && npm run mobile:build` → los tres en verde.
- [ ] **Step 5:** Commit `refactor(web): retirar pantallas de cliente, técnico y proveedor`.

### Task 5: Dependencias, techos y documentación

**Files:**
- Modify: `package.json`, `package-lock.json` (solo si aplica), `scripts/ui-rules.baseline.json` (solo vía `--update`), `../PRODUCT.md`, `../DESIGN.md`, `../docs/design/NAVEGACION.md`, `../ARQUITECTURA.md`, `../docs/mobile-paridad.md`

- [ ] **Step 1:** Buscar `@angular/google-maps` en `src/` y `projects/`. Sin imports reales: `npm uninstall @angular/google-maps`. Con imports: dejarlo y anotar quién lo usa.
- [ ] **Step 2:** `npm run ui:check`. Si dice que alguna regla bajó: `npm run ui:update`.
- [ ] **Step 3:** En los cinco documentos, corregir toda afirmación de que la web atiende a cliente, técnico o proveedor, incluida la tabla de superficies de `PRODUCT.md`. No reescribir lo demás.
- [ ] **Step 4:** `npm run ui:check && npx ng build && npx ng test --watch=false && npm run mobile:build` → verde.
- [ ] **Step 5:** Commit `docs: la web es solo panel de administración`.

## Verificación final

- [ ] `git diff main --stat -- backend frontend/projects/mobile` sin resultados.
- [ ] Buscar en `frontend/src` enlaces a `/cliente`, `/tecnico`, `/proveedor`, `/registro`, `/perfil` como rutas de pantalla (las URL de la API no cuentan): ninguno.
- [ ] Contra backend local, en navegador: login con admin, contable y cliente; `/recuperar`; abrir una OT desde monitoreo; marcador a `/cliente/panel` con sesión de cliente.
- [ ] Reportar la salida de los comandos y lo que no se pudo verificar. `CONTABLE` seguirá con 403 en `/api/admin/**`: es del proyecto de roles.
