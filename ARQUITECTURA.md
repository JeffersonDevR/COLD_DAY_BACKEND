# Arquitectura de Cold Day

> Documento vivo de referencia del sistema. Generado a partir de un análisis exhaustivo del código en `backend/` (última actualización: 2026-09-29). Actualízalo cuando cambien decisiones estructurales relevantes.

## Estado del monorepo

Este repositorio contiene el **backend** (`backend/`) y ya existe también una carpeta **`frontend/`** (proyecto Angular, committeada) — a diferencia de lo que decía una versión anterior de este documento, el frontend ya no está vacío ni vive en una carpeta hermana `cold_day_forntend` fuera del repo. La Especificación de Requisitos IEEE 830 v3.4 (agosto 2026) documenta un pivote de arquitectura del 28 de agosto de 2026: frontend unificado en Angular (Angular Universal/SSR para SEO) con empaquetado nativo condicional vía Ionic/Capacitor, reemplazando una decisión anterior de Astro + Flutter. Esta revisión no cubrió el contenido de `frontend/` en detalle (quedó fuera del alcance de la revisión de base de datos) — pendiente que el equipo actualice esta sección con el detalle real (base URL consumida, autenticación, CORS, etc.).

## 1. Stack tecnológico

- **Spring Boot 4.1.1**, Java 25 (toolchain de Gradle), Gradle Wrapper.
- Spring Web MVC, Spring Data JPA, Spring Security, Bean Validation.
- `springdoc-openapi` 2.8.5 (Swagger UI en `/swagger-ui.html`, OpenAPI en `/v3/api-docs`).
- JWT vía `io.jsonwebtoken` (JJWT) 0.12.6.
- Lombok.
- Persistencia: PostgreSQL + PostGIS como único motor (dev, test y prod), gestionado con **Flyway** (`db/migration/V*.sql`) + `ddl-auto=validate`. Los tests levantan su propio contenedor con **Testcontainers**. Ver §14.
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
- La búsqueda de técnicos candidatos delega en el módulo `geolocalizacion` (`TecnicoDisponibilidadRepository.buscarDisponiblesEnRadio`), que a su vez usa PostGIS.

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
- **Búsqueda espacial** (`TecnicoDisponibilidadRepository`): `PostgisTecnicoDisponibilidadAdapter`, SQL nativo con `ST_MakePoint(...)::geography`, `ST_DWithin`, `ST_Distance`, apoyado en el índice GiST parcial `idx_tecnico_disponible_ubicacion_geo` (definido en `V1__baseline_esquema_actual.sql`). Ningún tipo geométrico de PostGIS cruza el puerto de dominio — solo se devuelven VOs planos (`TecnicoCercano`). `CalculadoraHaversine` sigue en el dominio como servicio puro.
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
- **CORS**: `SecurityConfig.corsConfigurationSource` permite solo los orígenes de `app.cors.allowed-origins` (`CorsProperties`; variable `CORS_ALLOWED_ORIGINS`, lista separada por comas). Por defecto `http://localhost:4200`; en prod es obligatoria y el arranque falla si falta. Sin credenciales (el JWT viaja en `Authorization`).

## 14. Persistencia y esquema

- **Un solo motor: PostgreSQL/PostGIS** en dev, test y prod (Render). Localmente, `application.properties` apunta por defecto al contenedor `coldday-postgis` (`postgis/postgis:16-3.4`, `localhost:5433`, `cold_day/cold_day`). **Tests**: `PostgisContainerInitializer` (registrado en `src/test/resources/META-INF/spring.factories`) levanta un único contenedor `postgis/postgis:16-3.4` con Testcontainers por JVM y apunta el DataSource de todos los contextos a él; Flyway aplica las migraciones reales. Requiere Docker en ejecución. No hay base embebida ni `schema.sql`.
- **Esquema**: el esquema ya **no** lo gestiona `ddl-auto` — lo gestiona **Flyway** (`backend/src/main/resources/db/migration/V*.sql`), con `spring.jpa.hibernate.ddl-auto=validate` (Hibernate solo compara tablas/columnas/tipo/nulabilidad contra lo que Flyway aplicó y falla rápido en el arranque si no coinciden; nunca emite DDL). `schema-postgres.sql` fue eliminado — su contenido (extensión PostGIS, CHECK de `rol`, índice GiST parcial) vive ahora en `V1__baseline_esquema_actual.sql`.
  - **Introducción de Flyway sobre una base de datos ya existente**: `spring.flyway.baseline-on-migrate=true` + `baseline-version=1`. Contra una base con el esquema ya creado por el `ddl-auto=update` anterior (p. ej. Render la primera vez que se despliega este cambio), Flyway se autobaseliza en la versión 1 **sin ejecutar** el SQL de `V1` — solo corren de verdad las migraciones `> 1`. Contra una Postgres nueva/vacía (docker-compose local, futuros entornos), Flyway ejecuta `V1..Vn` desde cero, por lo que `V1` reproduce con precisión el esquema real (columnas, tipos, `CHECK` autogenerados por Hibernate para los enums, UNIQUE, los 17 índices de `@Table(indexes=...)`, el índice GiST parcial) para que ese entorno nuevo termine idéntico al punto de partida real.
  - **Migraciones actuales** (`V2` en adelante, aditivas sobre el baseline): `V2` añade `FOREIGN KEY ... NOT VALID` para las referencias cross-módulo que antes eran columnas escalares sin integridad real en Postgres (no se tocó el mapeo JPA — siguen sin `@ManyToOne`); `NOT VALID` evita que datos huérfanos preexistentes rompan el deploy, y se valida manualmente después con `ALTER TABLE ... VALIDATE CONSTRAINT ...` cuando se confirme que los datos están limpios. `V3` reemplaza los `UNIQUE` globales de `usuario.correo`/`tecnico.numero_identificacion`/`proveedor.nit` por índices únicos parciales (`WHERE activo = true`), para que un registro con soft-delete no bloquee ese valor para siempre. `V4`/`V5` migran `ot.diagnostico/presupuesto/evidencia_urls` y `tecnico.categorias_servicio/certificaciones` de `varchar(4000)` a `jsonb` nativo (acompañado de `@JdbcTypeCode(SqlTypes.JSON)` en las entidades, manteniendo los mismos `AttributeConverter` de Jackson). `V6` migra `usuario.fecha_registro` (el único timestamp del proyecto que no usaba `Instant`) a `timestamptz`.
- **Geoespacial**: PostGIS con SQL nativo (`ST_MakePoint`, `ST_DWithin`, `ST_Distance`) sobre columnas `double` planas + índice GiST — sin dependencia de driver espacial en Gradle.
- Value objects complejos (`Diagnostico`, `Presupuesto`, categorías, certificaciones) se persisten como `jsonb` en Postgres vía `AttributeConverter` dedicados por campo + `@JdbcTypeCode(SqlTypes.JSON)`; `evidencia_urls` sigue el mismo patrón.
- **Tablas del módulo `proveedores`** (aditivas sobre el modelo original): `proveedor`, `requerimiento_insumo`, `requerimiento_insumo_item` y `oferta_insumo` (esta última **sin** `precio_total`) con sus índices. La tabla `ot` tiene además `auxiliares_requeridos INT NOT NULL DEFAULT 0`, `distancia_km DOUBLE PRECISION` (nullable) y `tarifa_fuente VARCHAR(20)` (nullable). No hay migración descendente — cualquier rollback de esquema requiere una migración `V` nueva.

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

- Falta configuración de **CORS** — ya **no** es una deuda solo futura: existe una carpeta `frontend/` (Angular) en este mismo repo, así que si ya consume esta API desde otro origen, esto es bloqueante hoy, no "en cuanto exista un frontend".
- Notificaciones push (`ot`) y de vigencia documental (`tecnicos`) son solo logging — falta integrar transporte real (FCM/email).
- Guardas de autorización asimétricas entre `OtController` (cada endpoint anotado) y `TecnicoController` (solo dos endpoints con `@PreAuthorize` explícito) — verificar si la protección real recae en otro lado o si falta reforzarla.
- El frontend ya existe (`frontend/`, ver "Estado del monorepo") pero esta revisión no cubrió su contenido — falta documentar aquí el contrato real de consumo (base URL, autenticación, manejo de errores) más allá del OpenAPI/Swagger expuesto por el backend.
- **Resuelto 2026-09-29**: gestión de esquema sin Flyway/Liquibase. Ahora Postgres usa Flyway (`db/migration/`) + `ddl-auto=validate`; ver §14. Quedan como deuda aparte (fuera de esta revisión, centrada en la base de datos): no hay pipeline de CI que corra los tests antes del `autoDeploy` de Render, y el seeder de datos demo (`DevDataSeeder`) queda activo por defecto salvo que se fije `APP_SEED_ENABLED=false` explícitamente en el entorno de producción.
