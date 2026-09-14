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

