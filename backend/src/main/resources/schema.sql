CREATE TABLE IF NOT EXISTS tecnico (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero_identificacion VARCHAR(255) NOT NULL UNIQUE,
    nombres VARCHAR(255) NOT NULL,
    apellidos VARCHAR(255) NOT NULL,
    telefono VARCHAR(255),
    email VARCHAR(255),
    foto_url VARCHAR(255),
    estado_operativo VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    categorias_servicio JSON,
    certificaciones JSON
);
