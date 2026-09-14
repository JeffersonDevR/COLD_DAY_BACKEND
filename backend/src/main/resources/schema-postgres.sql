-- Postgres/PostGIS bootstrap, ONLY for the "postgres" profile
-- (spring.sql.init.schema-locations in application-postgres.properties).
-- Runs AFTER Hibernate creates the tables
-- (spring.jpa.defer-datasource-initialization=true), so the GiST index lands
-- on the existing tecnico table. Never runs on H2 (extension unknown there).
CREATE EXTENSION IF NOT EXISTS postgis;

-- RNF-03: spatial index for the ST_DWithin/ST_Distance radius search
-- (RF-F1-07) in PostgisTecnicoDisponibilidadAdapter.
CREATE INDEX IF NOT EXISTS idx_tecnico_ubicacion_geo
    ON tecnico USING GIST ((ST_MakePoint(longitud, latitud)::geography));
