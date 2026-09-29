-- usuario.fecha_registro era el único timestamp del proyecto sin zona
-- horaria (LocalDateTime, poblado con LocalDateTime.now(ZoneId.systemDefault())
-- en el dominio) — los otros ~21 campos de timestamp de las demás 12
-- entidades usan Instant/timestamptz. Se alinea aquí.
--
-- "USING ... AT TIME ZONE 'UTC'" es deliberado y no intercambiable con un
-- ::timestamptz a secas: un cast directo interpretaría los valores existentes
-- según el timezone de sesión/servidor de Postgres (no confirmable de
-- antemano en Render), pudiendo desplazar silenciosamente cada fecha
-- histórica. Declarar explícitamente "estos valores ya son UTC" es
-- consistente con que el resto del proyecto trata todo como Instant (UTC).
--
-- Debe desplegarse junto con el cambio de Usuario.java / UsuarioJpaEntity.java
-- (LocalDateTime -> Instant) y los DTOs UsuarioResponse/UsuarioApiResponse
-- (mismo commit/deploy).

ALTER TABLE usuario ALTER COLUMN fecha_registro TYPE timestamptz
    USING fecha_registro AT TIME ZONE 'UTC';
