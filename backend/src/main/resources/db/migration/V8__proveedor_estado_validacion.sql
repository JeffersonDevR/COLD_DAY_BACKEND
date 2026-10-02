-- Ciclo de validacion documental del PROVEEDOR, espejo exacto de
-- tecnico.estado_validacion / tecnico.motivo_rechazo_validacion.
--
-- Por que: hoy la elegibilidad del proveedor es SOLO proveedor.activo. Eso
-- deja un agujero de autorizacion real: un proveedor se registra y despacha
-- insumos sin que nadie valide nunca su documentacion. EstadoValidacionProveedor
-- ya existe en el dominio con cero usos; esta migracion le da columna, y
-- ProveedorJpaEntity.toDomain() la rehidrata para que la puerta
-- Proveedor.exigirValidado() signifique algo en cada lectura.
--
-- V1__baseline_esquema_actual.sql es snapshot y usa
-- spring.flyway.baseline-on-migrate con baseline-version=1, asi que NO se
-- re-corre en bases ya baselined. Toda columna nueva va aqui.
--
-- Sentencias planas (sin IF NOT EXISTS), igual que V2/V3/V4: Flyway versiona
-- por checksum y nunca re-corre una migracion aplicada.

-- ------------------------------------------------- decision de backfill --
-- ADD COLUMN ... DEFAULT 'PENDIENTE' NOT NULL es la opcion segura y la elegida:
--   1) Postgres 11+ evalua un DEFAULT constante en tiempo de metadata, sin
--      reescribir la tabla: es O(1) sobre cualquier tamano, a diferencia del
--      patron UPDATE + ALTER COLUMN SET NOT NULL, que reescribe dos veces.
--   2) Las filas existentes quedan en PENDIENTE, que es la verdad: nadie
--      valido su documentacion todavia, asi que arrancan en el estado honesto
--      y quedan bloqueadas por exigirValidado() hasta que un administrador las
--      apruebe.
--   3) El DEFAULT se elimina en la misma migracion (Abajo) para que la
--      columna quede igual que en tecnico: NOT NULL sin DEFAULT, y sea la
--      aplicacion la unica que puede fijar el estado. Un DEFAULT permanente
--      esconderia un bug de mapeo, que es exactamente la data loss silenciosa
--      que este ciclo viene a cerrar.
ALTER TABLE proveedor
    ADD COLUMN estado_validacion character varying(255) NOT NULL DEFAULT 'PENDIENTE';

ALTER TABLE proveedor
    ADD COLUMN motivo_rechazo_validacion character varying(500);

-- Mismo CHECK que tecnico_estado_validacion_check (V1 linea 54): el unico
-- valor legal es el que existe en EstadoValidacionProveedor, que sigue siendo
-- la unica fuente de verdad. El dominio es la regla; la base la impide.
ALTER TABLE proveedor ADD CONSTRAINT proveedor_estado_validacion_check
    CHECK (((estado_validacion)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'APROBADO'::character varying, 'RECHAZADO'::character varying, 'SUSPENDIDO'::character varying])::text[])));

-- La columna ya quedo poblada; se retira el DEFAULT para forzar a la aplicacion
-- a mapear el estado explicito en cada INSERT/UPDATE.
ALTER TABLE proveedor ALTER COLUMN estado_validacion DROP DEFAULT;
