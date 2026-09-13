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
    certificaciones VARCHAR(4000)
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
