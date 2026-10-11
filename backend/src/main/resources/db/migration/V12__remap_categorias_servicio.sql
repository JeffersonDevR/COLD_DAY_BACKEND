-- V12 — Remap the legacy ELECTRODOMESTICOS specialization to LAVADORAS and
-- tighten the OT category domain to the canonical 5-literal catalog.
--
-- Order matters (design WS9): remap persisted rows BEFORE recreating the CHECK
-- constraint, otherwise the ALTER fails on the existing ELECTRODOMESTICOS rows.
-- Idempotent/defensive: safe to re-run; row counts are preserved (UPDATE only).
-- V1 is an immutable baseline, so the original constraint is recreated here
-- rather than edited in place.

-- 1) Remap the persisted OT category.
UPDATE ot
SET categoria_servicio = 'LAVADORAS'
WHERE categoria_servicio = 'ELECTRODOMESTICOS';

-- 2) Remap the persisted technician categories element-wise (jsonb array).
UPDATE tecnico
SET categorias_servicio = (
    SELECT COALESCE(
               jsonb_agg(DISTINCT CASE WHEN elem = 'ELECTRODOMESTICOS' THEN 'LAVADORAS' ELSE elem END),
               '[]'::jsonb)
    FROM jsonb_array_elements_text(categorias_servicio) AS t(elem))
WHERE categorias_servicio @> '["ELECTRODOMESTICOS"]'::jsonb;

-- 3) Recreate the OT category CHECK constraint against the 5 target literals.
ALTER TABLE ot DROP CONSTRAINT IF EXISTS ot_categoria_servicio_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ot_categoria_servicio_check'
          AND conrelid = 'ot'::regclass
    ) THEN
        ALTER TABLE ot
            ADD CONSTRAINT ot_categoria_servicio_check
            CHECK (categoria_servicio::text = ANY (
                ARRAY['CAMARAS_VIGILANCIA', 'REFRIGERACION', 'AIRE_ACONDICIONADO',
                      'LAVADORAS', 'ELECTRICIDAD']::text[]));
    END IF;
END $$;
