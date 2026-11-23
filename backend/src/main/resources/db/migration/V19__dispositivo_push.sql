-- V19 - Tokens de dispositivo para notificaciones push (FCM).
--
-- Un token identifica una instalacion de la app, no a una persona: si otra
-- cuenta inicia sesion en el mismo telefono, el token se reasigna (UNIQUE por
-- token). Un usuario puede tener varios dispositivos.
--
-- Append-only: V1-V18 no se tocan. IF NOT EXISTS por idempotencia (convencion V15).

CREATE TABLE IF NOT EXISTS dispositivo_push (
    id bigserial PRIMARY KEY,
    usuario_id bigint NOT NULL REFERENCES usuario(id),
    token character varying(512) NOT NULL,
    plataforma character varying(10) NOT NULL,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dispositivo_push_plataforma_check
        CHECK (plataforma IN ('ANDROID', 'IOS', 'WEB'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_dispositivo_push_token
    ON dispositivo_push (token);

-- Envio: todos los tokens de un usuario.
CREATE INDEX IF NOT EXISTS idx_dispositivo_push_usuario
    ON dispositivo_push (usuario_id);
