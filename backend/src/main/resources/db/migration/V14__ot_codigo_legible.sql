-- Human-readable code of an OT: OT-YYYY-#### (UTC creation year + zero-padded
-- per-year sequence, e.g. OT-2026-0007). The UUID stays the API identity; this
-- code is the handle a client, a technician or an administrator can read, write
-- down or say over the phone.
--
-- BACKFILL RULE (deterministic, stated here so nobody has to guess): existing
-- rows are numbered by CREATION ORDER, which is (creada_en, id). id is the
-- tiebreaker because creada_en is not unique and a tie would otherwise be
-- resolved by whatever order the planner feels like. The year is the UTC year of
-- creada_en, the same year the application formats from the Clock instant that
-- stamped it, so a backfilled code is indistinguishable in shape from an
-- allocated one. A row without a business timestamp (creada_en is nullable in
-- the baseline, although every creation path stamps it) is grouped under 1970
-- and numbered last.
--
-- The application derives the next number of a year as (highest one already
-- issued for that year) + 1, so this backfill has to satisfy the unique index
-- below from the start: row_number() over (year, creada_en, id) is unique per
-- year by construction.
--
-- Flat statements (no IF NOT EXISTS), same as V2/V3/V4/V7/V11: Flyway versions
-- by checksum and never re-runs an applied migration.

ALTER TABLE ot ADD COLUMN codigo character varying(20);

UPDATE ot
SET codigo = 'OT-' || to_char(numerada.creada_en_utc, 'YYYY') || '-'
        || lpad(numerada.nro::text, 4, '0')
FROM (
    SELECT id,
           COALESCE(creada_en, 'epoch'::timestamptz) AT TIME ZONE 'UTC' AS creada_en_utc,
           row_number() OVER (
               PARTITION BY to_char(COALESCE(creada_en, 'epoch'::timestamptz) AT TIME ZONE 'UTC', 'YYYY')
               ORDER BY COALESCE(creada_en, 'epoch'::timestamptz), id
           ) AS nro
    FROM ot
) numerada
WHERE ot.id = numerada.id;

-- Uniqueness is an invariant of the base, not of the application: the code is
-- the human handle of an order, so two orders can never share one. This index is
-- also the backstop that turns a duplicate allocation (two concurrent creations
-- of the same year) into a failed insert instead of two orders disputing a code.
-- Partial because the column is nullable — NULL means "no code yet", and in SQL
-- NULL != NULL.
CREATE UNIQUE INDEX idx_ot_codigo
    ON ot (codigo)
    WHERE codigo IS NOT NULL;

COMMENT ON COLUMN ot.codigo IS
    'Human-readable order code OT-YYYY-####: UTC creation year + per-year sequence. Assigned once at creation, never regenerated. Unique where not null (idx_ot_codigo).';
