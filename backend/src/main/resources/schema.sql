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
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tecnico (
    id BIGINT PRIMARY KEY REFERENCES usuario(id),
    numero_identificacion VARCHAR(255) NOT NULL UNIQUE,
    foto_url VARCHAR(255),
    estado_operativo VARCHAR(30) NOT NULL DEFAULT 'FUERA_DE_SERVICIO',
    estado_validacion VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    motivo_rechazo_validacion VARCHAR(500),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    categorias_servicio VARCHAR(4000),
    certificaciones VARCHAR(4000)
);

CREATE TABLE IF NOT EXISTS documento_tecnico (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tecnico_id BIGINT NOT NULL REFERENCES tecnico(id),
    tipo VARCHAR(255) NOT NULL,
    fecha_vencimiento DATE
);
