# Arquitectura de Cold Day

> Documento vivo de referencia del sistema. Generado a partir de un análisis exhaustivo del código en `backend/` (última actualización: 2026-09-23). Actualízalo cuando cambien decisiones estructurales relevantes.

## Estado del monorepo

Este repositorio contiene el **backend** completo (`backend/`). La carpeta hermana `cold_day_forntend` (fuera de este repo, en `proyecto_cold_day/`) está vacía a la fecha de este documento — el frontend aún no se ha empezado a programar. Cuando exista, documentar aquí cómo consume esta API (base URL, autenticación, CORS).

## 1. Stack tecnológico

- **Spring Boot 4.1.1**, Java 25 (toolchain de Gradle), Gradle Wrapper.
- Spring Web MVC, Spring Data JPA, Spring Security, Bean Validation.
- `springdoc-openapi` 2.8.5 (Swagger UI en `/swagger-ui.html`, OpenAPI en `/v3/api-docs`).
- JWT vía `io.jsonwebtoken` (JJWT) 0.12.6.
- Lombok.
- Persistencia: H2 (dev/test, en memoria) y PostgreSQL + PostGIS (prod), sin Flyway/Liquibase — esquema gestionado con `ddl-auto` de Hibernate + archivos SQL manuales de respaldo.
- Jacoco para cobertura, SonarQube configurado (`sonar.projectKey=Cold-day-backend`).
- Sin dependencia de driver espacial (JTS/Hibernate Spatial): PostGIS se usa mediante SQL nativo puro.

## 2. Estilo arquitectónico

Arquitectura **hexagonal / DDD por módulos verticales**. Paquete raíz `com.sena.cold_day.core`.

```
core/
├── modules/
│   ├── usuarios/
│   ├── clientes/
│   ├── tecnicos/
│   ├── ot/
│   ├── geolocalizacion/
│   ├── maps/
│   ├── proveedores/
│   └── administracion/
└── shared/
    ├── domain/            (Point, value objects compartidos)
    ├── errors/            (ApiError, contrato de error uniforme)
    └── infrastructure/
        ├── security/      (JWT, filtros, encoders)
        ├── config/        (Clock bean, etc.)
        ├── openapi/       (Swagger config)
        └── scheduling/    (@EnableScheduling)
```

Cada módulo replica el mismo patrón interno:

```
<modulo>/
├── domain/
│   ├── aggregates/        (raíces de agregado, sin anotaciones JPA/Spring)
│   ├── entities/          (entidades internas del agregado)
│   ├── valueobjects/      (records/VOs, con validación en constructor)
│   ├── events/            (eventos de dominio, publicados vía ApplicationEventPublisher)
│   ├── exception/         (excepciones de dominio, mapeadas a HTTP en infra)
│   ├── repository/        (puertos — interfaces)
│   └── services/           (puertos de servicio de dominio, p.ej. NotificacionPort)
├── application/
│   ├── usecases/          (orquestación, transacciones, un caso de uso = una operación de negocio)
│   ├── dto/
│   └── mappers/
└── infrastructure/
    ├── api/
    │   ├── controllers/
    │   ├── requests/
    │   └── responses/
    ├── persistence/       (JpaEntity + fromDomain/toDomain, SIN relaciones @ManyToOne — FKs escalares)
    ├── repository/         (adaptadores que implementan los puertos de dominio)
    ├── notification/      (adaptadores de notificación, hoy solo logging)
    └── scheduling/        (jobs @Scheduled propios del módulo)
```

**Principio clave observado en todo el código:** el dominio nunca depende de JPA ni de Spring. Cada agregado tiene una entidad JPA paralela (`XxxJpaEntity`) con métodos explícitos `fromDomain()` / `toDomain()`. Las claves foráneas entre módulos se guardan como columnas escalares (UUID/Long), nunca como `@ManyToOne`, para no acoplar el modelo de persistencia entre módulos.

## 3. Mapa de módulos de negocio

| Módulo | Responsabilidad | Agregado(s) raíz |
|---|---|---|
| `usuarios` | Identidad, login, JWT, recuperación de contraseña, roles | `Usuario` |
| `clientes` | Perfil de cliente (B2B/B2C), dirección y ubicación | `Cliente` |
| `tecnicos` | Perfil de técnico: categorías, certificaciones/documentos, validación y disponibilidad | `Tecnico` |
| `ot` (órdenes de trabajo) | Ciclo de vida completo de una orden de servicio, despacho geolocalizado | `Ot`, entidad `OfertaOt` |
| `geolocalizacion` | Captura de ubicación GPS y búsqueda espacial de técnicos cercanos | (sin agregado propio — orquesta sobre `Tecnico`/`Cliente`) |
| `maps` | Proxy seguro a Google Maps (geocoding, autocomplete, distance matrix) | (stateless) |
| `administracion` | Liquidaciones de pago técnico↔plataforma, disputas, métricas de dashboard | `Liquidacion`, entidad `Disputa` |
| `proveedores` | Identidad del proveedor y despacho de insumos (solicitud, oferta al proveedor, entrega) | `Proveedor`, `RequerimientoInsumo`, entidad `OfertaInsumo` |

## 4. Módulo `usuarios`

- **Agregado `Usuario`**: nombre, correo, passwordHash, teléfono, foto, rol, `habeasDataAceptado`, `activo`, **`tokenVersion`** (contador para revocar JWT emitidos al cambiar contraseña).
- **Rol** (`Rol` enum): `CLIENTE, TECNICO, ADMINISTRADOR, CONTABLE, PROVEEDOR`. El rol `PROVEEDOR` es aditivo: `SecurityConfig`, `JwtTokenIssuer` y `JwtAuthenticationFilter` son genéricos sobre el enum y no requirieron cambios.
- **Casos de uso**: `RegistrarUsuarioUseCase`, `AutenticarUsuarioUseCase` (login → JWT), `RecuperarContrasenaUseCase` (no enumera existencia de correos), `RestablecerContrasenaUseCase` (consume token, incrementa `tokenVersion`).
- **Recuperación de contraseña**: token de 32 bytes aleatorios (Base64URL), se persiste solo el hash SHA-256 — nunca el token en claro (`SecureRandomTokenGenerator`, `infrastructure/security/`).
- **Endpoints** (`/api/usuarios`): `POST /` (registro, público), `POST /login` (público), `POST /recuperar-contrasena` (público), `POST /reset-contrasena` (público).
- El agregado **no** implementa `UserDetails` ni hay `UserDetailsService` en el módulo — el dominio se mantiene libre de Spring Security. La emisión de JWT (`JwtTokenIssuer`) y el encoder de password (`PasswordEncoderAdapter`, BCrypt costo 12) viven en `core/shared/infrastructure/security/` e inyectan en los casos de uso vía los puertos `TokenIssuer` / `PasswordEncoderPort`.

## 5. Módulo `clientes`

- **Agregado `Cliente`**: `usuarioId` (referencia a `usuarios`), `tipoCliente` (`B2B`/`B2C`), `direccionPrincipal` (calle/ciudad/barrio + `Point` opcional), `activo`.
- Relación 1:1 con `Usuario`, forzada por unicidad de `usuario_id` (con manejo de condición de carrera vía `DataIntegrityViolationException → 409`).
- **Endpoints** (`/api/clientes`): `POST /` (crea perfil para el usuario autenticado — el `usuarioId` se toma siempre del principal, nunca del body), `PUT /me/ubicacion` (delega en el caso de uso de `geolocalizacion`).
- Persistencia: dirección codificada en una sola columna (`DireccionPrincipalCodec`, separador `|` con escape), lat/lon en columnas propias.

## 6. Módulo `tecnicos`

- **Agregado `Tecnico`**: `usuarioId`, número de identificación, `categoriasServicio` (set), `certificaciones` (set), `ubicacion` (Point), `trackingActivo`, y **dos máquinas de estado ortogonales**:
  - `EstadoValidacion` (documental, CU-03): `PENDIENTE → APROBADO | RECHAZADO`; `APROBADO → SUSPENDIDO` (por vencimiento documental).
  - `EstadoOperativo` (disponibilidad): `FUERA_DE_SERVICIO, DISPONIBLE, OCUPADO, BLOQUEADO_POR_LIQUIDACION`.
- Invariantes relevantes en el agregado:
  - Solo se puede aprobar validación si **todas** las certificaciones están vigentes (si no, `DocumentacionIncompletaException`).
  - `cambiarEstado()` exige `APROBADO`; bloquea pasar a `DISPONIBLE` si está `BLOQUEADO_POR_LIQUIDACION`; rechaza cualquier cambio mientras está `OCUPADO`.
  - `liberarOrden()` (tras cerrar una OT) solo reactiva a `DISPONIBLE` si sigue `APROBADO` — un técnico suspendido no se reactiva accidentalmente.
- **Casos de uso**: `RegistrarTecnicoUseCase` (crea `Usuario` + `Tecnico` en una transacción), `ActualizarTecnicoUseCase`, `BuscarTecnicoUseCase`, `CambiarDisponibilidadUseCase` (el toggle de disponibilidad), `EliminarTecnicoUseCase` (soft delete), `ValidarDocumentacionTecnicoUseCase` (CU-03, admin aprueba/rechaza), `VerificarVigenciaDocumentalUseCase` (barrido diario).
- **Endpoints** (`/api/tecnicos`): `POST /`, `GET /`, `GET /{id}`, `PUT /{id}`, `PUT /{id}/estado`, `PUT /me/ubicacion` (con guard), `PATCH /{id}/validacion` (rol `ADMINISTRADOR`), `POST /{id}/documentos`, `DELETE /{id}`.
  - ⚠️ **Observación**: solo `/me/ubicacion` y `/{id}/validacion` llevan `@PreAuthorize` explícito a nivel de controlador; el resto de endpoints no tiene guard propio (a diferencia de `OtController`, que sí anota cada endpoint). Revisar si la protección real depende de la config global de `SecurityConfig` o si falta reforzarla.
- **Job programado**: `ProgramadorVigencia` — diario a las 06:00 (`cron` configurable vía `app.vigencia.cron`), suspende técnicos con documentos/certificaciones vencidas y notifica vencimientos próximos (30 días de antelación).
- Notificación de vencimiento: `LoggingNotificacionVigenciaAdapter` — solo logging, sin transporte real (email/push pendiente).

## 7. Módulo `ot` (órdenes de trabajo) — el núcleo del negocio

### Máquina de estados

Agregado [`Ot`](backend/src/main/java/com/sena/cold_day/core/modules/ot/domain/aggregates/Ot.java), transiciones validadas centralmente por `TransicionesOt`:

```
SOLICITADA
  → BUSCANDO_TECNICO
      → ASIGNADA
          → EN_CAMINO
              → EN_DIAGNOSTICO
                  → EN_REPARACION
                      → FINALIZADA                (terminal positivo)
                      → DISPUTADA
                          → FINALIZADA
                          → CANCELADA
                  → CANCELADA
                  → DISPUTADA
                      → FINALIZADA
                      → CANCELADA
          → CANCELADA
      → CANCELADA
      → SIN_TECNICOS_DISPONIBLES                   (terminal negativo)
```

Terminales: `FINALIZADA`, `CANCELADA`, `SIN_TECNICOS_DISPONIBLES`. Transición inválida → `TransicionOtInvalidaException` (HTTP 409).

### Despacho geolocalizado

- Radio inicial **10 km**, ventana de oferta **60 segundos** por radio.
- `ProgramadorEscalamientoOt` corre cada **5 segundos** (`app.dispatch.escalamiento-ms`) y, para cada OT con ventana vencida: expira ofertas pendientes, y si aún no hay técnico asignado, **escala el radio** en incrementos de 5 km hasta un máximo de 25 km (10→15→20→25); si se agota el radio máximo sin técnico, la OT pasa a `SIN_TECNICOS_DISPONIBLES` y se publica el evento correspondiente.
- La búsqueda de técnicos candidatos delega en el módulo `geolocalizacion` (`TecnicoDisponibilidadRepository.buscarDisponiblesEnRadio`), que a su vez usa PostGIS (prod) o cálculo Haversine en memoria (dev/H2).

### Aceptación atómica de ofertas

`AceptarOfertaUseCase` resuelve la condición de carrera "varios técnicos aceptan la misma OT" sin locks explícitos:
1. `otRepository.intentarAsignar(...)` → UPDATE condicional `WHERE estado='BUSCANDO_TECNICO'` (0 filas afectadas ⇒ ya la tomó otro técnico ⇒ `OfertaNoDisponibleException`).
2. `ofertaRepository.intentarAceptar(...)` → UPDATE condicional `WHERE estado='PENDIENTE' AND expira_en > ahora`.
3. Se invalidan las ofertas hermanas pendientes de la misma OT.
4. `tecnico.aceptarOrden()` → pasa a `OCUPADO`.
5. Se registra la transición `BUSCANDO_TECNICO → ASIGNADA` en el historial y se publica `OtAsignada`.

Todo dentro de una única transacción — cualquier fallo revierte la OT a `BUSCANDO_TECNICO`.

### Tarifa de visita por distancia

`CalculadoraTarifaVisita` es un servicio de dominio puro sobre `(distanciaKm, duracionMin)`. La fórmula y los tramos **no se persisten**: viven solo en configuración (`app.tarifa.*`), de modo que cambiar el precio no requiere migración.

- Base plana e **inclusiva** dentro del radio metropolitano (`radio-metropolitano-km`, 8 km): `base` (30.000 COP).
- Tramos marginales por **distancia absoluta** `[desde, hasta)` con tarifas crecientes: 8–12 km → 1.800 COP/km, 12–18 → 2.200, 18–24 → 2.600, 24–30 → 3.200. La suma es continua en cada frontera compartida.
- `tarifa = min(base + marginal, precio-max)` (tope 80.000 COP, aplicado **antes** del redondeo) y luego redondeo a `redondeo-cop` (100 COP).
- Más allá de `radio-max-km` (30 km) la estimación queda **fuera de rango**: `POST /api/ot/tarifa/estimar` responde **HTTP 200** con `banda` y `tarifa` en `null` (nunca un centinela); `400` se reserva a entrada malformada.
- `banda` es el índice 0..4 del tramo más alto alcanzado (`0` = solo base).
- Fuente de la distancia: `ROAD` (Google Maps Distance Matrix) o `LINEAL` (Haversine al centro configurado) cuando Maps no está disponible; **una falla de Maps nunca bloquea la OT**.
- La tarifa autoritativa se calcula y persiste en `ot.tarifa_visita` / `ot.distancia_km` / `ot.tarifa_fuente` al **finalizar** o al **cancelar fuera de la ventana gratuita**; aceptar una oferta no persiste nada.

Claves `app.tarifa.*`: `base`, `radio-metropolitano-km`, `radio-max-km`, `precio-max`, `redondeo-cop`, `centro-lat`, `centro-lng`; los tramos usan los defaults de `TarifaProperties`.

### Auxiliares (conteo declarado al aceptar)

Al aceptar una oferta, el técnico puede declarar cuántos auxiliares requiere. Es un **conteo sin identidad, cuentas ni pagos**: nunca se cobra ni entra en presupuesto o liquidación.

- El cuerpo de `POST /api/ofertas/{id}/aceptar` es **opcional** (`{auxiliaresRequeridos?: int}`, por defecto 0); `@Min(0)` en el wire y un máximo configurable (`app.auxiliares.max`, default 10) validado en `AceptarOfertaUseCase` **antes de cualquier escritura** (400 si se excede).
- El conteo viaja en el **mismo UPDATE condicional** de la aceptación (`asignarSiDisponible`); no hay una segunda escritura sobre el agregado `@Version`, ni endpoint de mutación posterior a la aceptación.
- `OtResponse`/`OtApiResponse` exponen `auxiliaresRequeridos`, con `0` para filas heredadas.

### Otras reglas de negocio

- **Ventana de cancelación gratuita**: 10 minutos desde la asignación (`VENTANA_CANCELACION_GRATUITA`); fuera de esa ventana se cobra la tarifa de visita calculada por distancia (ver arriba). La constante `TARIFA_VISITA_BASE` fue eliminada: la única autoridad de precio es `CalculadoraTarifaVisita`.
- **Rechazo de presupuesto por el cliente** termina la OT como `CANCELADA` con motivo `RECHAZO_PRESUPUESTO` y cobro de la tarifa de visita calculada por distancia — decisión de diseño que diverge de un mapeo literal de requisitos, documentada en el código.
- **Historial append-only**: cada transición se acumula en una lista pendiente dentro del agregado (`cambiosPendientes`) y se drena/persiste atómicamente al guardar — garantiza que nunca se pierde un registro de auditoría, incluso si el `save()` falla a medio camino.
- **Disputas**: `abrirDisputa`/`resolverDisputaConAcuerdo`/`resolverDisputaSinAcuerdo` existen en el agregado `Ot`, pero se orquestan desde `administracion.GestionarDisputaUseCase` (no desde `ot.application`) — es ese caso de uso el que publica los eventos terminales tras resolver.

### Endpoints

`/api/ot`: `POST /` (crear), `GET /{id}`, `GET /{id}/historial`, `POST /{id}/iniciar-desplazamiento` (TECNICO), `POST /{id}/diagnostico` (TECNICO, acepta `insumos`), `POST /{id}/presupuesto/aprobar` (CLIENTE), `POST /{id}/presupuesto/rechazar` (CLIENTE), `POST /{id}/finalizar` (TECNICO), `POST /{id}/cancelar` (CLIENTE o TECNICO), `POST /tarifa/estimar` (autenticado, solo lectura).

`/api`: `POST /ofertas/{id}/aceptar` (TECNICO, cuerpo opcional `{auxiliaresRequeridos?}`), `GET /tecnicos/me/ofertas` (TECNICO, solo ofertas vigentes).

### Notificaciones

`LoggingNotificacionPushAdapter` — solo logging; el estado de la oferta en base de datos es la fuente de verdad, nunca depende de que la notificación push se entregue (diseño explícito para que el despacho no se bloquee por fallas de transporte). FCM/push real está pendiente de implementar.

## 8. Módulo `proveedores` (despacho de insumos)

Contexto delimitado que cubre la identidad del proveedor y el despacho de insumos tras el diagnóstico. El dominio **no importa tipos de `ot`/`tecnicos`**: las referencias externas son `UUID` escalares.

- **Agregados y entidades**: `Proveedor` (identidad de negocio, `usuarioId`, ubicación `Point`, `categoriasInsumo` como metadato, `activo`); raíz `RequerimientoInsumo` (por OT + técnico, con líneas de insumo de texto libre) y entidad `OfertaInsumo` (una por proveedor activo).
- **Elegibilidad**: la difusión llega a **todos** los proveedores `activo=true`; `categorias_insumo` es metadato, no un filtro de elegibilidad.
- **Estados**:
  - `EstadoRequerimiento`: `SOLICITADO → ASIGNADO → ENTREGADO`; `SOLICITADO → SIN_PROVEEDOR` (terminal reintentable). **No existe `CANCELADO`** a nivel raíz.
  - `OfertaInsumoEstado`: `PENDIENTE → ACEPTADA | RECHAZADO | EXPIRADA | CANCELADA` (la invalidez por hermano ganador es `CANCELADA`; el rechazo explícito usa el literal `RECHAZADO`).
- **Ciclo de despacho**: diagnóstico con `insumos` no vacío → `RequerimientoInsumo(SOLICITADO)` + una `OfertaInsumo(PENDIENTE)` por proveedor activo → notificación best-effort (hoy solo logging; su falla **no** cambia el estado autoritativo) → el primer `aceptar` gana el UPDATE condicional y marca las ofertas hermanas `CANCELADA` → `entregar` mueve `ASIGNADO → ENTREGADO`. Un barrido `@Scheduled` expira ofertas vencidas y resuelve solicitudes sin proveedor. Cero insumos no crea nada y el despacho nunca bloquea el ciclo de la OT.
- **Endpoints** (rol `PROVEEDOR`, salvo alta/listado que son `ADMINISTRADOR`):
  - `POST /api/proveedores` (ADMINISTRADOR) — alta: crea el `Usuario` con rol `PROVEEDOR` y el `Proveedor` en una sola transacción (201/400/403/409).
  - `GET /api/proveedores` (ADMINISTRADOR) — listado, incluye inactivos.
  - `GET /api/proveedores/me/solicitudes` (PROVEEDOR) — ofertas pendientes con sus líneas.
  - `POST /api/insumos/{ofertaId}/aceptar`, `POST /api/insumos/{ofertaId}/rechazar`, `POST /api/insumos/{id}/entregar` (PROVEEDOR) — 409 si la oferta ya no está disponible.
- **Semilla**: `DevDataSeeder` crea 1 proveedor idempotente (`proveedor1@coldday.com.co`, password demo `demo1234`).

## 9. Módulo `geolocalizacion`

- No expone controladores propios; sus casos de uso son invocados desde `TecnicoController`/`ClienteController` y desde `ot`.
- **Casos de uso**: `ActualizarUbicacionClienteUseCase`, `ActualizarUbicacionTecnicoUseCase`, `DesactivarTrackingTecnicoUseCase`.
- **Búsqueda espacial** (`TecnicoDisponibilidadRepository`), dos implementaciones intercambiables por perfil Spring:
  - `H2TecnicoDisponibilidadAdapter` (`@Profile("!postgres")`): filtro por bounding box en SQL + cálculo exacto Haversine en memoria (`CalculadoraHaversine`).
  - `PostgisTecnicoDisponibilidadAdapter` (`@Profile("postgres")`): SQL nativo con `ST_MakePoint(...)::geography`, `ST_DWithin`, `ST_Distance`, apoyado en el índice GiST `idx_tecnico_ubicacion_geo` (definido en `schema-postgres.sql`). Ningún tipo geométrico de PostGIS cruza el puerto de dominio — solo se devuelven VOs planos (`TecnicoCercano`).
- **Desacople por eventos**: `DesactivarTrackingListener` escucha `EventoTerminalOt` (publicado por `ot`/`administracion`) y apaga el tracking del técnico asignado cuando la OT llega a un estado terminal, conservando la última ubicación para auditoría. Tolera técnico ausente sin revertir la transacción de la OT.

## 10. Módulo `maps`

- Proxy backend a Google Maps Platform para que la API key nunca llegue al navegador.
- APIs consumidas vía `RestClient` (no `RestTemplate`): Geocoding, Places Autocomplete, Distance Matrix.
- Feature flag: `app.maps.enabled` — si está deshabilitado o sin key, `MapsNoDisponibleException` → 503.
- **Endpoints** (`/api/maps`, requiere autenticación): `GET /estado`, `POST /geocode`, `GET /inversa`, `GET /autocompletar`, `POST /distancia`.
- Totalmente desacoplado del resto del dominio: no depende de `Tecnico`/`Cliente`/`Ot`, y nada del backend lo llama — es de uso previsto para el frontend (autocompletar direcciones, mostrar distancia/ETA).

## 11. Módulo `administracion`

Dos submodelos independientes bajo un mismo módulo:

- **`Liquidacion`** (RF-F1-23/24/26): ciclo de liquidación de pagos cobrados en efectivo/transferencia por el técnico.
  - Estados: `PENDIENTE_CONSIGNACION → EN_VERIFICACION → APROBADA | RECHAZADA` (rechazada puede volver a `EN_VERIFICACION` tras nuevo comprobante).
  - Comisión configurable (`app.liquidacion.comision-porcentaje`, default **15%**), calculada al registrar.
  - Mientras hay una liquidación pendiente, el técnico queda `BLOQUEADO_POR_LIQUIDACION` (no puede pasar a `DISPONIBLE`) hasta que un admin la aprueba.
- **`Disputa`** (RF-F1-25): mediación administrativa sobre una OT, abierta por el cliente, resuelta por un admin con o sin acuerdo (afecta directamente el estado de la `Ot` asociada).
- **Casos de uso**: `RegistrarPagoUseCase`, `CargarComprobanteUseCase`, `VerificarComprobanteUseCase`, `GestionarDisputaUseCase`, `ConsultarMetricasAdminUseCase` (agrega lectura cruzada de `ot` + `tecnicos` + `administracion` para el dashboard).
- **Endpoints**: `/api/admin/**` (rol `ADMINISTRADOR`: métricas, liquidaciones, disputas), `/api/disputas` (rol `CLIENTE`: abrir disputa), `/api/liquidaciones` (rol `TECNICO`: registrar pago, subir comprobante).

## 12. Integración entre módulos (resumen)

No todo está desacoplado por eventos — es una mezcla deliberada:

- **Llamadas directas**: `ot.application` inyecta `TecnicoRepository` de `tecnicos` directamente para sincronizar disponibilidad (ocupar/liberar) dentro de su propia transacción. `administracion.GestionarDisputaUseCase` hace lo mismo con `OtRepository` y `TecnicoRepository`.
- **Dependencia de dominio compartido**: el agregado `Ot` nunca importa nada de `tecnicos` — solo guarda un `TecnicoId` (value object). El acoplamiento está en la capa de aplicación, no en el dominio.
- **Eventos de dominio** (`ApplicationEventPublisher`, síncronos, misma transacción): usados específicamente para el efecto secundario de tracking (`geolocalizacion` escuchando `EventoTerminalOt` de `ot`/`administracion`). Los agregados en sí no publican eventos — la publicación es responsabilidad exclusiva de la capa de aplicación.
- **`ot` → `geolocalizacion`**: puente real entre disponibilidad + ubicación + categoría de servicio, vía `TecnicoDisponibilidadRepository`.
- **`ot` → `proveedores` (una sola dirección)**: `RegistrarDiagnosticoUseCase` invoca `SolicitarInsumoUseCase` tras persistir el diagnóstico, pasando `otId`/`tecnicoId` como `UUID`; el contexto `proveedores` no importa tipos de `ot`.
- **`maps`**: aislado, sin llamadas entrantes ni salientes hacia otros módulos de dominio.

## 13. Seguridad

- **Stateless JWT** (JJWT/HMAC), `JwtAuthenticationFilter` insertado antes de `UsernamePasswordAuthenticationFilter`. CSRF deshabilitado (API sin cookies).
- Claims del token: `sub` (usuarioId), `rol`, `ver` (token version), `iat`, `exp`.
- **Revocación por versión**: al cambiar contraseña se incrementa `Usuario.tokenVersion`; el filtro compara el claim `ver` contra el valor persistido y limpia el contexto de seguridad si no coincide — revoca todos los tokens previos sin necesitar lista negra.
- BCrypt costo 12 (`PasswordEncoderAdapter`).
- Reglas de autorización (`SecurityConfig`): público → `/actuator/health`, Swagger, `POST /api/usuarios` (registro/login/recuperación), `POST /api/tecnicos` (auto-registro); `PATCH /api/tecnicos/*/validacion` y `/api/admin/**` → rol `ADMINISTRADOR`; el resto requiere autenticación.
- Nuevos endpoints de `proveedores` con `@PreAuthorize`: alta y listado de proveedores → `ADMINISTRADOR`; portal de insumos (`/api/proveedores/me/solicitudes`, `/api/insumos/**`) → `PROVEEDOR`. No se agregó ningún matcher `permitAll`.
- `AuthenticationEntryPoint`/`AccessDeniedHandler` propios, devuelven el mismo contrato `ApiError` que el resto de la API.
- Manejo de errores: **sin `@ControllerAdvice` global** — cada módulo define el suyo (`@RestControllerAdvice(assignableTypes=...)`) mapeando sus excepciones de dominio a HTTP, pero todos comparten el mismo tipo de respuesta (`ApiError`).
- ⚠️ **No hay configuración de CORS** en ningún punto del código — pendiente para cuando exista un frontend que llame desde otro origen.

## 14. Persistencia y esquema

- Sin Flyway/Liquibase. Gestión de esquema vía `spring.sql.init` + Hibernate `ddl-auto`:
  - Perfil por defecto (H2): `schema.sql` corre **antes** de que Hibernate cree las tablas; `ddl-auto=create-drop` es la autoridad real (el SQL es un espejo documental con `IF NOT EXISTS`).
  - Perfil `postgres`: `schema-postgres.sql` corre **después** de Hibernate (`defer-datasource-initialization=true`), porque necesita que la tabla `tecnico` ya exista para crear el índice espacial.
  - En Render, `SPRING_JPA_HIBERNATE_DDL_AUTO=update` sobreescribe el `create-drop` por defecto para no perder datos en cada deploy.
- **Geoespacial dual**: dev/H2 usa Haversine en Java; prod usa PostGIS con SQL nativo (`ST_MakePoint`, `ST_DWithin`, `ST_Distance`) sobre columnas `double` planas + índice GiST — sin dependencia de driver espacial en Gradle.
- Value objects complejos (`Diagnostico`, `Presupuesto`, categorías, certificaciones, URLs de evidencia) se persisten como JSON vía `AttributeConverter` dedicados por campo.
- **Tablas nuevas de este cambio** (aditivas): `proveedor`, `requerimiento_insumo`, `requerimiento_insumo_item` y `oferta_insumo` (esta última **sin** `precio_total`) con sus índices. La tabla `ot` gana `auxiliares_requeridos INT NOT NULL DEFAULT 0`, `distancia_km DOUBLE PRECISION` (nullable) y `tarifa_fuente VARCHAR(20)` (nullable). En `postgres`/`ddl-auto=update` Hibernate deriva los `ALTER TABLE` del mapeo de entidades; `schema.sql` es el espejo documental. No hay migración descendente.

## 15. Jobs programados

| Job | Frecuencia | Acción |
|---|---|---|
| `ProgramadorEscalamientoOt` (`ot`) | cada 5s (`app.dispatch.escalamiento-ms`) | Escala radio de búsqueda / agota opciones para OTs con ventana de oferta vencida |
| `ProgramadorVigencia` (`tecnicos`) | diario 06:00 (`app.vigencia.cron`) | Suspende técnicos con documentación vencida, notifica vencimientos próximos (30 días) |
| `ProgramadorExpiracionInsumo` (`proveedores`) | cada 60s (`app.insumos.barrido-ms`) | Expira ofertas de insumo vencidas y resuelve solicitudes sin proveedor |

## 16. Despliegue

- **Dockerfile** multi-stage: build con `eclipse-temurin:25-jdk` (Gradle, tests excluidos del build de imagen), runtime con `eclipse-temurin:25-jre` corriendo como usuario no-root. Puerto expuesto `8090`.
- **Render** (`render.yaml`, Blueprint): servicio web Docker, plan free, `rootDir: backend`, health check en `/actuator/health`, `autoDeploy: true`, perfil `prod,postgres`. Variables sensibles (`JWT_SECRET`, credenciales Postgres, `GOOGLE_MAPS_API_KEY`) marcadas `sync: false` — se configuran manualmente en el dashboard de Render, nunca en el repo.

## 17. Observaciones / deuda técnica conocida

- Falta configuración de **CORS** (bloqueante en cuanto exista un frontend en otro origen).
- Notificaciones push (`ot`) y de vigencia documental (`tecnicos`) son solo logging — falta integrar transporte real (FCM/email).
- Guardas de autorización asimétricas entre `OtController` (cada endpoint anotado) y `TecnicoController` (solo dos endpoints con `@PreAuthorize` explícito) — verificar si la protección real recae en otro lado o si falta reforzarla.
- El frontend (`cold_day_forntend`) todavía no existe — no hay contrato de consumo real más allá del propio OpenAPI/Swagger expuesto por el backend.
