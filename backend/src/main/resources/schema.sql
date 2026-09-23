-- Schema authority (design D8): Hibernate `create-drop` is authoritative for the
-- H2 dev/test schema. This file is the canonical hand-maintained DDL mirror kept
-- in lockstep with the entity model, and it runs before JPA initialization
-- (spring.jpa.defer-datasource-initialization=false). `CREATE TABLE IF NOT EXISTS`
-- is a no-op for entity tables, which Hibernate (re)creates.

CREATE TABLE IF NOT EXISTS usuario (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    correo VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(200) NOT NULL,
    telefono VARCHAR(30),
    foto_url VARCHAR(255),
    rol VARCHAR(20) NOT NULL DEFAULT 'CLIENTE',
    fecha_registro TIMESTAMP NOT NULL,
    habeas_data_aceptado BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    token_version INT NOT NULL DEFAULT 0
);

-- Own-UUID identity (design D12): the technician has its own UUID primary key
-- and references usuario through a scalar usuario_id foreign key.
CREATE TABLE IF NOT EXISTS tecnico (
    id UUID PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuario(id),
    numero_identificacion VARCHAR(255) NOT NULL UNIQUE,
    estado_operativo VARCHAR(30) NOT NULL DEFAULT 'FUERA_DE_SERVICIO',
    estado_validacion VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    motivo_rechazo_validacion VARCHAR(500),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    categorias_servicio VARCHAR(4000),
    certificaciones VARCHAR(4000),
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    tracking_activo BOOLEAN NOT NULL DEFAULT FALSE,
    ubicacion_actualizada_en TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documento_tecnico (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tecnico_id UUID NOT NULL REFERENCES tecnico(id),
    tipo VARCHAR(255) NOT NULL,
    fecha_vencimiento DATE
);

CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuario(id),
    tipo VARCHAR(10) NOT NULL,
    direccion_principal VARCHAR(500),
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    activo BOOLEAN NOT NULL DEFAULT TRUE
    );

-- Single-use password reset tokens (design D10). Only the SHA-256 hash is
-- stored; the plaintext token never reaches the database.
CREATE TABLE IF NOT EXISTS token_recuperacion (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    token_hash CHAR(64) NOT NULL UNIQUE,
    expira_en TIMESTAMP NOT NULL,
    usado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP NOT NULL
);

-- OT core (design schema delta). Hibernate create-drop is authoritative for H2
-- (D8); this mirror stays in lockstep with OtJpaEntity. `version` drives
-- optimistic locking.
CREATE TABLE IF NOT EXISTS ot (
    id UUID PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    tecnico_id UUID REFERENCES tecnico(id),
    categoria_servicio VARCHAR(30),
    descripcion_falla VARCHAR(1000),
    evidencia_urls VARCHAR(4000),
    direccion VARCHAR(500),
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    estado VARCHAR(30) NOT NULL,
    radio_km DOUBLE PRECISION,
    ventana_expira_en TIMESTAMP,
    creada_en TIMESTAMP,
    asignada_en TIMESTAMP,
    finalizada_en TIMESTAMP,
    cancelada_por VARCHAR(20),
    motivo_cancelacion VARCHAR(30),
    tarifa_visita DECIMAL(12,2),
    diagnostico VARCHAR(4000),
    presupuesto VARCHAR(4000),
    -- Authoritative tariff detail (design AD13, spec tar.R6). Both nullable so
    -- pre-existing rows survive the additive ALTER and stay NULL until the
    -- tariff is persisted at finalization/cancellation.
    distancia_km DOUBLE PRECISION,
    tarifa_fuente VARCHAR(20),
    -- Auxiliar count declared at acceptance (design AD2, spec aux.R1/aux.R4).
    -- Non-null with a server default so the additive ALTER fills pre-existing
    -- rows with 0; the count is only ever written by the atomic acceptance gate.
    auxiliares_requeridos INT NOT NULL DEFAULT 0,
    version BIGINT
);

-- Append-only OT state history (RNF-09, design D3). The domain port exposes only
-- append/listarPorOt; the entity is @Immutable. `estado_origen` is null for the
-- creation entry, which lands directly in SOLICITADA.
CREATE TABLE IF NOT EXISTS ot_estado_historial (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ot_id UUID NOT NULL REFERENCES ot(id),
    estado_origen VARCHAR(30),
    estado_destino VARCHAR(30) NOT NULL,
    actor_usuario_id BIGINT,
    actor_rol VARCHAR(20),
    actor VARCHAR(20),
    ocurrido_en TIMESTAMP NOT NULL,
    motivo VARCHAR(500)
);

-- Dispatch offers (design D4/D6, RF-F1-09). One row per notified technician with
-- a server-authoritative expiry; the offer state is authoritative and pollable.
-- Hibernate create-drop is authoritative for H2 (D8); this mirror stays in lockstep
-- with OfertaOtJpaEntity.
CREATE TABLE IF NOT EXISTS oferta_ot (
    id UUID PRIMARY KEY,
    ot_id UUID NOT NULL REFERENCES ot(id),
    tecnico_id UUID NOT NULL REFERENCES tecnico(id),
    radio_km DOUBLE PRECISION,
    estado VARCHAR(20) NOT NULL,
    creada_en TIMESTAMP,
    expira_en TIMESTAMP,
    resuelta_en TIMESTAMP
);

-- Liquidacion operativa (RF-F1-23/24/26, CU-12/13): un cobro en
-- efectivo/transferencia por OT con su comision y el ciclo del comprobante.
CREATE TABLE IF NOT EXISTS liquidacion (
    id UUID PRIMARY KEY,
    ot_id UUID NOT NULL UNIQUE REFERENCES ot(id),
    tecnico_id UUID NOT NULL REFERENCES tecnico(id),
    monto_cobrado DECIMAL(12,2) NOT NULL,
    medio_pago VARCHAR(20) NOT NULL,
    porcentaje_comision DECIMAL(5,4) NOT NULL,
    valor_comision DECIMAL(12,2) NOT NULL,
    estado VARCHAR(30) NOT NULL,
    comprobante_url VARCHAR(1000),
    motivo_rechazo VARCHAR(500),
    creada_en TIMESTAMP,
    verificada_en TIMESTAMP
);

-- Mediacion administrativa de disputas (RF-F1-25, SRS §5.3).
CREATE TABLE IF NOT EXISTS disputa (
    id UUID PRIMARY KEY,
    ot_id UUID NOT NULL REFERENCES ot(id),
    motivo VARCHAR(1000) NOT NULL,
    estado VARCHAR(30) NOT NULL,
    resolucion VARCHAR(1000),
    creada_en TIMESTAMP,
    resuelta_en TIMESTAMP
);

-- Proveedor identity (spec P1, design AD7). Brand-new additive table: it has no
-- legacy rows, so the nullable/defaulted rule that protects existing tables from
-- `ddl-auto=update` ALTERs does not apply here. Hibernate create-drop remains
-- authoritative for H2 (D8); this mirror stays in lockstep with ProveedorJpaEntity.
-- A Proveedor is linked to exactly one usuario (usuario_id NOT NULL UNIQUE);
-- categorias_insumo is descriptive metadata, never an eligibility gate.
CREATE TABLE IF NOT EXISTS proveedor (
    id UUID PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuario(id),
    razon_social VARCHAR(255) NOT NULL,
    nit VARCHAR(50) NOT NULL UNIQUE,
    telefono VARCHAR(30),
    direccion VARCHAR(500),
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    categorias_insumo VARCHAR(1000),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP
);


