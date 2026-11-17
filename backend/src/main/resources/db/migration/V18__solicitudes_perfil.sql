-- V18 — Solicitudes de cambio de perfil (feature coherencia-ordenes-perfiles, T4).
--
-- Reemplaza la adopcion self-service irrestricta por un flujo de aprobacion:
-- un usuario autenticado pide CLIENTE o TECNICO, un ADMINISTRADOR resuelve.
-- Solo estos dos perfiles son conmutables: ADMINISTRADOR y CONTABLE nunca se
-- piden, y el perfil deseado debe diferir del rol inicial persistido.
--
-- Append-only: V1-V17 no se tocan. Sentencias con IF NOT EXISTS/DO para que
-- reaplicar la migracion a mano no rompa nada (convencion V15).

CREATE TABLE IF NOT EXISTS solicitud_perfil (
    id bigserial PRIMARY KEY,
    usuario_id bigint NOT NULL REFERENCES usuario(id),
    perfil_deseado character varying(20) NOT NULL,
    estado character varying(20) NOT NULL DEFAULT 'PENDIENTE',
    motivacion character varying(1000) NOT NULL,
    creada_en timestamptz NOT NULL DEFAULT now(),
    resuelta_en timestamptz,
    motivo_rechazo character varying(500),
    CONSTRAINT solicitud_perfil_perfil_deseado_check
        CHECK (perfil_deseado IN ('CLIENTE', 'TECNICO')),
    CONSTRAINT solicitud_perfil_estado_check
        CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA'))
);

-- Una sola solicitud abierta por (usuario, perfil): ademas de la comprobacion
-- del caso de uso, la base cierra la carrera de dos POST concurrentes.
CREATE UNIQUE INDEX IF NOT EXISTS uk_solicitud_perfil_pendiente
    ON solicitud_perfil (usuario_id, perfil_deseado)
    WHERE estado = 'PENDIENTE';

-- Bandeja admin: bandeja por estado ordenada por fecha, siempre con LIMIT
-- desde el caso de uso (BE-P1: ninguna lista sin paginar).
CREATE INDEX IF NOT EXISTS idx_solicitud_perfil_estado_creada
    ON solicitud_perfil (estado, creada_en DESC);
