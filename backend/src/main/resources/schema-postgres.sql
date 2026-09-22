-- Postgres/PostGIS bootstrap, ONLY for the "postgres" profile
-- (spring.sql.init.schema-locations in application-postgres.properties).
-- Runs AFTER Hibernate creates the tables
-- (spring.jpa.defer-datasource-initialization=true), so the GiST index lands
-- on the existing tecnico table. Never runs on H2 (extension unknown there).
CREATE EXTENSION IF NOT EXISTS postgis;

-- RNF-03: spatial index for the ST_DWithin/ST_Distance radius search
-- (RF-F1-07) in PostgisTecnicoDisponibilidadAdapter. Superseded by the
-- partial index below, scoped to the same predicate the query always applies.
DROP INDEX IF EXISTS idx_tecnico_ubicacion_geo;

CREATE INDEX IF NOT EXISTS idx_tecnico_disponible_ubicacion_geo
    ON tecnico USING GIST ((ST_MakePoint(longitud, latitud)::geography))
    WHERE activo = true AND estado_validacion = 'APROBADO' AND estado_operativo = 'DISPONIBLE';
