# Roles internos y cuentas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contable y Recursos Humanos usan el panel con permisos propios, y el administrador gestiona sus cuentas con invitación por correo.

**Architecture:** Cada ruta compartida pide un permiso (`hasAuthority`) y un mapa único dice qué permisos tiene cada rol, con el backend como autoridad; las cuentas internas viven en el módulo `usuarios` y reutilizan el token de recuperación para invitar. La web añade el rol a menú, rutas y aterrizaje, una pantalla de cuentas y los documentos declarados en las dos pantallas de validación.

**Tech Stack:** Spring Boot 4.1 / Java 25 / Flyway / PostGIS; Angular 21 + Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-roles-internos-design.md` (sus tablas de permisos y de rutas son la referencia exacta).

## Global Constraints

- Rama nueva `feat/roles-internos` desde `origin/main`. No tocar `.agents/`, `node_modules/`, `skills-lock.json`.
- Permisos: `VER_OPERACION, GESTIONAR_CONSIGNACIONES, VER_TECNICOS, VALIDAR_DOCUMENTACION, GESTIONAR_DISPUTAS, GESTIONAR_CUENTAS`. El mapa rol → permisos existe en un archivo del backend y uno de la web; ninguna ruta compartida enumera roles.
- Rol nuevo: `RECURSOS_HUMANOS`, rótulo «Recursos Humanos». Migración `V23__rol_recursos_humanos.sql`; ninguna `V*` anterior se edita.
- Copy en tuteo, español de Colombia. No inventar plazos ni políticas.
- No subir techos: `npm run ui:check` y `node backend/scripts/check-backend-rules.mjs` antes y después. Sin `@Disabled`, `it.skip`, `eslint-disable`, `--no-verify`.
- Secretos: no imprimirlos ni copiarlos.
- **Este equipo no tiene Java ni Docker.** Las pruebas Java se escriben primero, pero su rojo y su verde solo se ven en el CI del PR. Cada tarea de backend lo anota como «sin verificar localmente» y no se declara hecha hasta que el CI pase.
- Web local: `NODE_OPTIONS=--no-experimental-webstorage npx ng test --watch=false --coverage=false < /dev/null` (desde `frontend/`).
- Un commit por tarea, `tipo(ámbito): mensaje` en español, con la línea `Co-Authored-By` de la sesión.

## Review Focus

- Contable o RR. HH. abren la URL de una pantalla ajena: vuelven a la suya, sin pantalla en blanco ni bucle. (Tarea 3)
- Una pantalla permitida llama de paso a una API prohibida (incumplimientos, enlaces de la Torre): no aparecen errores 403 ni enlaces muertos. (Tareas 3 y 5)
- Cuenta desactivada con sesión abierta: la siguiente petición recibe 401. (Tarea 2)
- Crear una cuenta con un correo ya usado por un cliente: mensaje claro, el formulario conserva lo escrito. (Tarea 4)
- Un técnico sin documentos, o con la carga fallida: se distingue «no declaró» de «no pudimos cargar». (Tarea 5)

---

### Task 1: Rol, permisos y rutas en el backend

**Files** (bajo `backend/src/main/java/com/sena/cold_day/core/` salvo indicación):
- Create: `backend/src/main/resources/db/migration/V23__rol_recursos_humanos.sql`, `modules/usuarios/domain/valueobjects/{Permiso,PermisosPorRol}.java`
- Modify: `shared/infrastructure/security/{AuthenticatedUser,JwtAuthenticationFilter,DevAuthBypassFilter}.java`
- Modify: `modules/usuarios/domain/valueobjects/Rol.java`, `shared/infrastructure/security/{SecurityConfig,AutorizacionPropietario}.java`, `shared/infrastructure/seed/DevDataSeeder.java`
- Modify: `modules/administracion/infrastructure/api/controllers/{AdminController,AdminStreamController}.java`, `modules/ot/infrastructure/api/controllers/OtController.java`, `modules/tecnicos/infrastructure/api/controllers/TecnicoController.java`, `modules/tecnicos/application/usecases/ListarDocumentosTecnicoUseCase.java`, `modules/proveedores/infrastructure/api/controllers/ProveedorController.java`
- Modify: `docs/backend/GUIA-BACKEND.md` (última migración V23)
- Test: Create `backend/src/test/java/com/sena/cold_day/core/shared/infrastructure/security/RolesInternosPermisosIT.java` y `backend/src/test/java/com/sena/cold_day/core/modules/usuarios/domain/valueobjects/PermisosPorRolTest.java`

**Interfaces — Produces:**
- `Rol.RECURSOS_HUMANOS`
- `enum Permiso` (los seis de Global Constraints)
- `static Set<Permiso> PermisosPorRol.de(Rol)` y `static Set<Rol> PermisosPorRol.rolesGestionables()` (roles con algún permiso, sin `ADMINISTRADOR`)
- `boolean AuthenticatedUser.tienePermiso(Permiso)` y `Collection<GrantedAuthority> AuthenticatedUser.authorities()` (`ROLE_x` más el nombre de cada permiso); los dos filtros usan este método
- `void AutorizacionPropietario.exigirLectorDeOt(AuthenticatedUser, OtResponse)` (`VER_OPERACION` o participante/admin)
- `void AutorizacionPropietario.exigirProveedorOAuditorDocumental(AuthenticatedUser, ProveedorId)` (`VALIDAR_DOCUMENTACION`, dueño o admin)
- `List<DocumentoTecnico> ListarDocumentosTecnicoUseCase.listarDeTecnico(TecnicoId)` (lanza `TecnicoNoEncontradoException` si no está activo)
- `GET /api/tecnicos/{id}/documentos` → `List<DocumentoTecnicoApiResponse>`

- [ ] **Step 1: Escribir las pruebas.** `PermisosPorRolTest`: cada rol da exactamente los permisos de la tabla del spec; `CLIENTE`, `TECNICO` y `PROVEEDOR` ninguno; `ADMINISTRADOR` todos; `rolesGestionables()` es `{CONTABLE, RECURSOS_HUMANOS}`.
  Prueba por ruta: `@SpringBootTest @AutoConfigureMockMvc`; tokens con `JwtTokenIssuer.emitir(...)` para usuarios que no existen en la base (el filtro los acepta). Una tabla `@ParameterizedTest` con cada fila del spec: método, ruta (ids inexistentes), roles permitidos. Aserciones: permitido → el estado **no** es 401 ni 403; negado → 403. Roles a recorrer: `ADMINISTRADOR, CONTABLE, RECURSOS_HUMANOS, CLIENTE`. Para `/api/ot/{id}` y su historial se usa una OT sembrada (con id inexistente el 404 llega antes del chequeo). El stream se prueba con ticket como en `AdminStreamIT`.
- [ ] **Step 2: Migración.** `ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_rol_check;` y recrearla con los cinco valores actuales más `RECURSOS_HUMANOS`.
- [ ] **Step 3: Rutas.** En `SecurityConfig`, antes de `/api/admin/**` → admin: `hasAuthority` para `GET metricas|ot` (`VER_OPERACION`), las cuatro rutas de liquidaciones (`GESTIONAR_CONSIGNACIONES`), `/api/admin/disputas/**` (`GESTIONAR_DISPUTAS`) y `/api/admin/cuentas/**` (`GESTIONAR_CUENTAS`); la regla de `PATCH /api/tecnicos/*/validacion` pide `VALIDAR_DOCUMENTACION`. En los controladores, `@PreAuthorize("hasAuthority('…')")` por método (en `AdminController` la anotación de clase se queda y cada método con permiso la sobrescribe). `GET /api/tecnicos` pide `VER_TECNICOS`; lista, documentos y validación de proveedores, `VALIDAR_DOCUMENTACION`. `consultar` e `historial` de `OtController` usan `exigirLectorDeOt`. `AdminStreamController` admite a quien tenga al menos un permiso. `DELETE` y `GET /{id}` de técnicos, incumplimientos, solicitudes de perfil y `GET /api/usuarios` no cambian.
- [ ] **Step 4: Documentos de técnico y sembrador.** Endpoint nuevo con `hasAuthority('VALIDAR_DOCUMENTACION')`; `ensureUsuario("Laura Rojas", "rrhh@coldday.com.co", "3167890123", Rol.RECURSOS_HUMANOS)`.
- [ ] **Step 5: Verificar.** `node backend/scripts/check-backend-rules.mjs` → ningún techo sube. Revisar que ningún `switch` sobre `Rol` quede incompleto (`grep -rn "case CONTABLE" backend/src`).
- [ ] **Step 6: Commit** `feat(backend): permisos de contable y Recursos Humanos`.

### Task 2: Cuentas internas e invitación

**Files** (bajo `.../core/modules/usuarios/`):
- Create: `application/usecases/GestionarCuentasInternasUseCase.java`, `domain/events/CuentaInternaInvitada.java`, `domain/exception/RolNoGestionableException.java`, `infrastructure/api/controllers/CuentasController.java`, `infrastructure/api/requests/{CuentaInternaApiRequest,EstadoCuentaApiRequest}.java`, `infrastructure/api/responses/CuentaApiResponse.java`
- Modify: `domain/aggregates/Usuario.java`, `domain/repository/UsuarioRepository.java`, `infrastructure/repository/UsuarioRepositoryAdapter.java`, `infrastructure/persistence/SpringDataUsuarioRepository.java`, `domain/services/NotificadorRecuperacion.java`, `infrastructure/listeners/SolicitudRecuperacionListener.java`, `infrastructure/mail/{Smtp,Resend,Logging}NotificadorRecuperacion.java`, `infrastructure/api/controllers/UsuarioControllerAdvice.java`
- Test: `UsuarioTest` (ampliar), create `infrastructure/api/controllers/CuentasApiIT.java`, y un caso de invitación por cada notificador en `infrastructure/mail/`

**Interfaces — Produces:**
- `static Usuario Usuario.crearCuentaInterna(String nombre, String correo, Rol rol, String passwordPlano, PasswordEncoderPort)` — solo roles de `PermisosPorRol.rolesGestionables()` (si no, `RolNoGestionableException`), `habeasDataAceptado=false`, `telefono=null`
- `void Usuario.reactivar()`
- `List<Usuario> UsuarioRepository.listarPorRoles(Collection<Rol>)` (ordenada por id)
- `record CuentaInternaInvitada(Long usuarioId, String correo, String token)`; `void NotificadorRecuperacion.invitar(CuentaInternaInvitada)`
- Contrato web: `GET /api/admin/cuentas` → `[{id:number, nombre, correo, rol, activa:boolean}]`; `POST` `{nombre, correo, rol}` → 201 con ese objeto, 409 correo usado, 400 rol no gestionable; `PATCH /api/admin/cuentas/{id}/estado` `{activa:boolean}` → 204, 404 si el id no es una cuenta gestionable

- [ ] **Step 1: Pruebas de dominio** en `UsuarioTest`: `crearCuentaInterna` deja habeas data en `false` y activa en `true`; rechaza `ADMINISTRADOR` y `CLIENTE`; `reactivar` tras `desactivar` deja activa.
- [ ] **Step 2: Pruebas de API** (`CuentasApiIT`): crear → 201 y existe un token de recuperación; duplicado con el correo de un cliente → 409; rol `ADMINISTRADOR` → 400; listar no incluye clientes ni administradores; desactivar → el JWT anterior de esa cuenta recibe 401 y el login falla; reactivar → vuelve a entrar; `PATCH` sobre un cliente → 404; `CONTABLE` en las tres rutas → 403.
- [ ] **Step 3: Implementar.** La contraseña inicial es `TokenGeneratorPort.generar()` y se descarta. El token se emite como en `RecuperarContrasenaUseCase` (vigencia 30 min, mismo repositorio) y el evento se publica en la transacción; el listener lo entrega `AFTER_COMMIT`. Desactivar hace `desactivar()` + `incrementarTokenVersion()`. `@PreAuthorize("hasAuthority('GESTIONAR_CUENTAS')")` en cada método; el advice del módulo cubre `CuentasController`.
- [ ] **Step 4: Texto de la invitación** (asunto `Te crearon una cuenta en COLD DAY`):

```
Hola,
Te crearon una cuenta para el panel de COLD DAY con este correo.
Pon tu contraseña en este enlace (vigente por 30 minutos):
%s
Si venció, usa «Recuperar contraseña» en la pantalla de ingreso.
```

- [ ] **Step 5: Verificar** `check-backend-rules` y que no quede otra implementación de `NotificadorRecuperacion` o `UsuarioRepository` sin los métodos nuevos (`grep -rn "implements NotificadorRecuperacion\|implements UsuarioRepository" backend/src`).
- [ ] **Step 6: Commit** `feat(backend): cuentas internas con invitación por correo`.

### Task 3: Permisos y rol en la web

**Files** (bajo `frontend/src/app/`):
- Create: `core/permisos.ts` y su spec
- Modify: `core/models/common.models.ts`, `core/ui/labels.ts`, `core/navihationError/panel-resolver.ts`, `core/service/auth.service.ts`, `core/service/mock-db.service.ts`, `shared/app.menu.ts`, `app.routes.ts`, `pages/dashboard-admin-page/dashboard-admin-page.{ts,html}`
- Test: sus `*.spec.ts`

**Interfaces — Produces:** `type Permiso`; `PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]>`; `rolesCon(permiso: Permiso): Rol[]`; `rolesGestionables(): Rol[]`; `Rol` incluye `'RECURSOS_HUMANOS'`; ruta de RR. HH. `/admin/validacion-tecnicos`; usuario mock `rrhh@coldday.com.co`.

- [ ] **Step 1: Pruebas.** `PERMISOS_POR_ROL` coincide con la tabla del spec; `rolLabel('RECURSOS_HUMANOS') === 'Recursos Humanos'`; `resolverPanel` y `getDashboardRouteForRole` → `/admin/validacion-tecnicos`; `buildMenu` por rol da exactamente el menú de la tabla del spec; con las rutas reales, RR. HH. en `/admin/dashboard` y Contable en `/admin/proveedores` terminan en su pantalla de inicio; la Torre de Control no muestra a Contable los accesos «Auditoría de Técnicos» ni «Bandeja Disputas».
- [ ] **Step 2:** correr y ver fallar.
- [ ] **Step 3: Implementar.** Menú y rutas piden `rolesCon(permiso)` en vez de listas de roles: dashboard, monitoreo y OT → `VER_OPERACION`; consignaciones → `GESTIONAR_CONSIGNACIONES`; validación y proveedores → `VALIDAR_DOCUMENTACION`; disputas → `GESTIONAR_DISPUTAS`. `rutaDePanel(rol)` se deriva de los permisos (`VER_OPERACION` → `/admin/dashboard`; si no, `VALIDAR_DOCUMENTACION` → `/admin/validacion-tecnicos`) y `getDashboardRouteForRole` la reutiliza. Los accesos de la Torre se muestran por permiso. Si `roleGuard` no lleva a la pantalla propia en el caso de la prueba, corregirlo ahí.
- [ ] **Step 4:** suite web y `npm run mobile:test` en verde.
- [ ] **Step 5: Commit** `feat(web): rol de Recursos Humanos en menú, rutas y Torre de Control`.

### Task 4: Pantalla de cuentas

**Files** (bajo `frontend/src/app/`):
- Create: `core/service/cuentas-api.ts`, `pages/admin-cuentas-page/admin-cuentas-page.{ts,html}`, con specs
- Modify: `app.routes.ts` (`admin/cuentas`, `rolesCon('GESTIONAR_CUENTAS')`, antes de `**`), `app.routes.spec.ts`, `shared/app.menu.ts` (entrada «Cuentas», `pi pi-users`), `core/service/mock-db.service.ts`

**Interfaces — Produces:** `interface CuentaInterna { id: number; nombre: string; correo: string; rol: Rol; activa: boolean }`; `CuentasApi.listar(): Observable<CuentaInterna[]>`, `.crear({nombre, correo, rol}): Observable<CuentaInterna>`, `.cambiarEstado(id: number, activa: boolean): Observable<void>`.

- [ ] **Step 1: Pruebas** del API (URL, método y cuerpo del contrato de la Task 2) y de la página: lista; las opciones de rol salen de `rolesGestionables()` con `rolLabel`; no envía con campos vacíos o correo inválido; éxito muestra «Cuenta creada. Enviamos la invitación a {correo}. Si no llega, la persona puede usar «Recuperar contraseña».» y limpia el formulario; 409 muestra «Ya existe una cuenta con ese correo.» y conserva lo escrito; desactivar y reactivar llaman `cambiarEstado` y recargan; error de carga muestra `app-carga-error`.
- [ ] **Step 2:** ver fallar. **Step 3:** implementar siguiendo `proveedores-admin-page` (señales, `OnPush`, toast, `avisarErrorAccion`). Desactivar pide confirmación. Mock en `mockDb` sobre las cuentas internas.
- [ ] **Step 4:** suite web, `npm run ui:check`, `npx ng build`; abrir la pantalla en modo mock y revisar a 375 px.
- [ ] **Step 5: Commit** `feat(web): gestión de cuentas internas`.

### Task 5: Documentos declarados en la validación

**Files** (bajo `frontend/src/app/`):
- Modify: `core/service/{tecnicos-api,proveedores-api}.ts`, `pages/validacion-tecnicos-page/*`, `pages/proveedores-admin-page/*`

**Interfaces — Consumes:** `GET /tecnicos/{id}/documentos` (Task 1). **Produces:** `TecnicosApi.getDocumentos(tecnicoId: string): Observable<DocumentoTecnicoResponse[]>` (mapea con `aDocumentoTecnico`; en mock, los del técnico en `mockDb`).

- [ ] **Step 1: Pruebas.** Cada pendiente muestra tipo y fechas de sus documentos; sin documentos: «No ha declarado documentos.»; fallo: «No pudimos cargar los documentos.» con reintento, distinto del anterior; ya no existe el enlace «Ver»; en proveedores, RR. HH. no ve «Incumplimientos de ETA» ni se llama `getIncumplimientos`, y el administrador sí.
- [ ] **Step 2:** ver fallar. **Step 3:** implementar con una carga por pendiente, estado por id (`cargando | error | listo`). Los botones Aprobar y Rechazar no cambian: el backend decide. `getDocumentos` de proveedores ya existe; en mock devuelve `mockDb.documentosDe(id)`.
- [ ] **Step 4:** suite web, `ui:check`, `ng build`; revisar ambas pantallas en modo mock.
- [ ] **Step 5: Commit** `fix(web): la validación muestra los documentos declarados`.

### Task 6: Documentación y cierre

**Files:** Modify `AGENTS.md` (usuario `rrhh…` en la lista de cambio de usuario), `ARQUITECTURA.md` y `PRODUCT.md` (los tres roles internos), spec (estado: implementado).

- [ ] **Step 1:** actualizar esas líneas, sin reescribir secciones.
- [ ] **Step 2:** suite web y móvil, `ui:check`, `check-backend-rules`, `ng build`; pegar resultados.
- [ ] **Step 3: Commit** `docs: roles internos`.
- [ ] **Step 4:** revisión final de la rama; con permiso, subir y abrir PR, y **esperar el CI del backend** antes de declararlo hecho.
