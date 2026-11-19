# Feature: coherencia-ordenes-perfiles

## Objective
Unificar la organización visual de las tres pantallas principales del móvil (panel de cliente, mis órdenes, mi cuenta), darles un componente de tarjeta de orden con prioridad real, y reemplazar el cambio de perfiles self-service por un flujo de solicitud al administrador (PQRS) con gating en frontend y backend.

## Problem
Reporte del usuario (2026-11-17):
1. Los rectángulos del historial / filtros (Todas, Activas, Completadas, Sin técnico) no tienen padding y el texto se sale.
2. En la home, "Mis equipos" debería decir "Mis órdenes".
3. Las cards de orden están mal organizadas; el ícono sobra y todo desalineado.
4. Falta "prioridad" en esas cards y en las futuras, en todos los componentes.
5. "Pedir técnico" y "Registrar equipo" usan botones visualmente distintos.
6. En Mi cuenta hay un rectángulo de debug: "El mismo usuario puede actuar como cliente…".
7. Solo quien se registró como técnico debería poder cambiar a cliente; los demás deben solicitarlo al admin por PQRS.
8. Las tres pantallas no comparten una organización; definir una y aplicarla, adaptándola al contenido.

## Baseline (verificado)
- Branch creada: `feat/coherencia-ordenes-perfiles` desde `main` (`d03ce3b`).
- Working tree con WIP ajeno sin commitear (no tocado en ninguna tarea).
- Mobile: Angular 21 + Ionic 9 / Capacitor 8, `frontend/projects/mobile`.
- Backend: Spring Boot 4 / Java 25 / PostGIS / Flyway, migraciones V1–V16 (V17 y V18 agregadas).
- `strict_tdd: false`. Fuente: Engram `sdd/cold_day_backend/testing-capabilities` (config, detectado 2026-10-13; tiene conflicto pendiente, se disclosed y no cambia el runner). Verificación funcional observada, sin ciclo RED/GREEN obligatorio.
- `prioridad` no existía en `OtResponse` ni en backend; no existía concepto PQRS en el repo.

## Decisions (usuario, 2026-11-17)
- **D1**: el flujo de perfiles/PQRS se implementa **frontend + backend** (no solo visual).
- **D2**: la prioridad es un **campo real** `Alta | Media | Baja`, con migración, contrato y chip reutilizable.
- **D3 (orquestador)**: el DEFAULT de BD permanece `MEDIA`; el cliente no elige prioridad en el alta; tabla V18 `solicitud_perfil` en el módulo `usuarios`; `perfil_deseado` solo CLIENTE/TECNICO distinto del rol inicial; resolución admin con override explícito; sin cambio de `usuario.rol`.
- **D4 (orquestador)**: `OtResponse.prioridad` es requerido en JSON, opcional en el modelo TS compartido con fallback `?? 'MEDIA'` para no reescribir ~52 fixtures.

## Scope
T1–T7, ejecutadas. Incluye actualización de `PRODUCT.md`, `DESIGN.md` y `TAREAS-UI.md`.

## Out of scope
- No se tocó el WIP ajeno sin commitear, ni se usó `checkout`/`reset`/`clean`.
- No se subieron techos de baseline front ni back.
- No se editaron migraciones V1–V16.
- No se cambiaron reglas de tarifas, cancelación ni asignación.
- No se implementaron notificaciones push/email reales del PQRS.

## Constraints
- Tuteo en todo copy nuevo (DESIGN UI-L1): el techo móvil bajó de 22 a 19.
- Chip de prioridad con tinta sobre tinte, texto visible y ≤10 % de cian (DESIGN §2.2).
- Padding por tokens `cd-*`; sin `env()` directo nuevo (UI-S1).
- Verificadores ejecutados antes y después en cada tarea.
- Un commit por tarea, Conventional Commit en español, sin atribución IA.

## Tasks (estado final)

### T1 — Corrección visual base de las 3 pantallas ✅ `c27aae1`
- [x] T1.1 Padding y `overflow` en filtros del historial a 320 px (`pantallas.css:86-108`).
- [x] T1.2 "Mis equipos" → "Mis órdenes" en botón, tab, título de página y ruta; ruta `/cliente/equipos` intacta.
- [x] T1.3 Cards sin ícono redundante, cabecera en una sola fila, `padding: 1rem` con `cd-ot--orden`, hueco `.cd-ot__prioridad` reservado.
- [x] T1.4 Footer de equipos con `ion-footer.cd-footer` + `ion-button.cd-cta expand="block"`.
- [x] T1.5 Bloque debug eliminado; voseo corregido (UI-L1 22→19).
- Checks: `ui:check` OK · `npx ng test mobile --watch=false` 316/316.

### T2 — Prioridad en backend ✅ `655c472`
- [x] T2.1 `V17__ot_prioridad.sql`: columna + CHECK `ot_prioridad_check`, DEFAULT permanente `MEDIA`, V1–V16 intactas.
- [x] T2.2 Enum `Prioridad`, agregado, todas las sobrecargas de `reconstituir` convergen (`null → MEDIA`), JPA, `OtResponse` y `OtApiResponse`; el cliente no elige prioridad.
- [x] T2.3 `OtPrioridadTest` (5 tests) y `OtApiIT` (16 tests) con Docker/Testcontainers, verdes.
- Checks: `backend-rules` OK (13/18/7/27) · `compileJava` OK · `tsc --noEmit` OK.

### T3 — Chip de prioridad reutilizable ✅ `dfbd201`
- [x] T3.1 `shared/ui/priority-chip/` con `input<Prioridad>('MEDIA')`, `cd-chip`, `data-testid` y etiqueta visible; tonos ALTA=cerrada, MEDIA=curso, BAJA=ok.
- [x] T3.2 Integrado en ambas cards con `?? 'MEDIA'`; `prioridad` propagada al view model `EquipoCliente`.
- [x] T3.3 Tabla de componentes y regla en `DESIGN.md`.
- Checks: `ui:check` OK · `ng test mobile` 321/321 · `ng test app` (equipos-cliente) 8/8.

### T4 — PQRS y gating de perfiles en backend ✅ `8ddec2f`
- [x] T4.1 `V18__solicitudes_perfil.sql` con CHECKs e índice único parcial de solicitudes abiertas.
- [x] T4.2 `POST /api/solicitudes-perfil` (auth), `GET /api/admin/solicitudes-perfil` paginado (ADMIN), 409 por duplicado.
- [x] T4.2b `PATCH /api/admin/solicitudes-perfil/{id}/resolver`: aprobar adopta el perfil con `desdeAdmin=true`; rechazar solo marca; sin rotación de token en rechazo.
- [x] T4.3 422 con `ApiError` suelto cuando el rol inicial persistido no es TECNICO; se lee del repositorio, no del JWT.
- [x] T4.4 `SolicitudPerfilUseCaseTest` 10/10, `SolicitudPerfilIT` 8/8, tests existentes actualizados (6/6 y 10/10), `gradlew build` completo verde.

### T5 — Solicitud de perfil y gating en Mi cuenta ✅ `3574915`
- [x] T5.1 Selector de modos con "Pídelo al admin" para roles no auto-adoptables, usando `AuthService.userRole`.
- [x] T5.2 Formulario (perfil + motivación 10–1000 chars) contra `POST /api/solicitudes-perfil`.
- [x] T5.3 Estados con `cd-skeleton`/`cd-error-alert`, éxito y aviso específico para 409.
- [x] T5.4 Specs de página y servicio; copy en tuteo.
- Checks: `ui:check` OK · `ng test mobile` 329/329 · `ng test app` 911/911.

### T6 — Shell compartido y coherencia final ✅ `0eca664`
- [x] T6.1 `cd-page` es el wrapper único de las 3 pantallas (0 `<ion-content>` propio), con extensión mínima del componente.
- [x] T6.2 Jerarquía eyebrow → título → resumen → filtros → cards → CTA, adaptada por contenido; cuenta sin footer inventado.
- [x] T6.3 `DESIGN.md` y `TAREAS-UI.md` actualizados (TU-01/TU-02 marcadas hechas).
- Checks: `ui:check` OK · `ng test mobile` 329/329 · `mobile:build` OK.

### T7 — Cierre y verificación ✅
- [x] T7.1 `PRODUCT.md` actualizado con la política de perfiles bajo aprobación admin.
- [x] T7.2 Verificadores finales: `ui:check` OK (UI-L1 19/22 bajó, ninguna subió) · `backend-rules` OK (13/18/7/27).
- [x] T7.3 APK debug compilado.

## Acceptance criteria
- [x] Filtros sin recorte a 320 px y cards con padding consistente.
- [x] Home dice "Mis órdenes" y las cards usan un solo patrón.
- [x] Toda card de orden muestra chip de prioridad con dato real del backend.
- [x] Los dos CTAs principales son visualmente idénticos.
- [x] No queda texto de debug en Mi cuenta y todo copy nuevo está en tuteo.
- [x] Un usuario registrado como cliente no puede auto-adquirir perfil técnico; recibe la solicitud al admin.
- [x] Endpoints autenticado, ADMIN y de resolución, con tests.
- [x] `npm run ui:check` y `node backend/scripts/check-backend-rules.mjs` OK sin techos nuevos.
- [x] APK debug compila.

## Progress / verification evidence
- 2026-11-17 — T1 `c27aae1` · T2 `655c472` · T3 `dfbd201` · T4 `8ddec2f` · T5 `3574915` · T6 `0eca664` · T7 docs+checks+APK.
- Verificación funcional observada en cada tarea; Docker/Testcontainers disponible y usado en T2/T4.
- `gradlew build` completo verde en T4; suites móvil 329/329 y web 911/911 en T5.

## Route declarations
- Exploración: `explore` delegado (mapa front y back).
- T1–T6: `delegated direct`, un writer por worktree, secuenciales.
- T7: edición mecánica en línea + comandos de verificación.

## Next step
Decisión del humano sobre push/PR y sobre la observación de T4: la adopción aprobada por admin siembra el perfil con datos mínimos (correo como identificación, "Por completar" en dirección) y el usuario debe completarlos después.
