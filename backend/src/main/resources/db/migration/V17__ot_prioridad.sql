-- Prioridad real de la orden (feature coherencia-ordenes-perfiles).
--
-- La columna es NOT NULL con DEFAULT permanente 'MEDIA': las filas existentes
-- quedan en MEDIA sin reescribir la tabla (Postgres evalúa el DEFAULT constante
-- en tiempo de metadata) y toda orden creada sin elegir prioridad nace en MEDIA.
-- El cliente NO elige prioridad al crear: el servidor la fija en Ot.crear.
-- A diferencia de V8, el DEFAULT NO se retira: es el valor de nacimiento de la
-- orden y la red de seguridad para cualquier INSERT que lo omita.
--
-- Sentencias planas (sin IF NOT EXISTS), igual que V2/V3/V4/V7/V11/V14: Flyway
-- versiona por checksum y nunca re-corre una migración aplicada.
ALTER TABLE ot
    ADD COLUMN prioridad character varying(10) NOT NULL DEFAULT 'MEDIA';

-- Mismo patrón de CHECK de ARRAY que V8: el único valor legal es el que existe
-- en el enum de dominio Prioridad, que sigue siendo la fuente de verdad.
ALTER TABLE ot ADD CONSTRAINT ot_prioridad_check
    CHECK (((prioridad)::text = ANY ((ARRAY['ALTA'::character varying, 'MEDIA'::character varying, 'BAJA'::character varying])::text[])));

COMMENT ON COLUMN ot.prioridad IS
    'Prioridad de la orden (ALTA/MEDIA/BAJA). DEFAULT MEDIA: valor de nacimiento y backfill de filas existentes.';
