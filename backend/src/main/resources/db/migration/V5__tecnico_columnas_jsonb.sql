-- Mismo patrón que V4, para tecnico.categorias_servicio/certificaciones.
-- Escritas únicamente por CategoriaServicioJsonConverter/CertificacionJsonConverter
-- (Jackson) — el cast ::jsonb es seguro por el mismo motivo.
--
-- Debe desplegarse junto con @JdbcTypeCode(SqlTypes.JSON) en TecnicoJpaEntity
-- (mismo commit/deploy).

ALTER TABLE tecnico ALTER COLUMN categorias_servicio TYPE jsonb USING categorias_servicio::jsonb;
ALTER TABLE tecnico ALTER COLUMN certificaciones TYPE jsonb USING certificaciones::jsonb;
