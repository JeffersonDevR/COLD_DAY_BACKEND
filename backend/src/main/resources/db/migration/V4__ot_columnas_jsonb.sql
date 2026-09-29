-- ot.diagnostico/presupuesto/evidencia_urls pasan de varchar(4000) (JSON
-- serializado a texto por AttributeConverter de Jackson) a jsonb nativo.
-- El cast ::jsonb es seguro: estas 3 columnas solo se escriben a través de
-- DiagnosticoJsonConverter/PresupuestoJsonConverter/EvidenciaUrlsJsonConverter,
-- que siempre serializan JSON válido (o escriben NULL) — no hay otra vía de
-- escritura. Si alguna fila tuviera texto no válido, Postgres lo reporta
-- exactamente (fila y valor) y aborta limpio, sin corromper nada.
--
-- Debe desplegarse junto con @JdbcTypeCode(SqlTypes.JSON) en OtJpaEntity
-- (mismo commit/deploy): Hibernate valida el tipo JDBC esperado contra el
-- real al arrancar (ddl-auto=validate), así que un desfase entre esta
-- migración y la anotación Java rompe el arranque.

ALTER TABLE ot ALTER COLUMN diagnostico TYPE jsonb USING diagnostico::jsonb;
ALTER TABLE ot ALTER COLUMN presupuesto TYPE jsonb USING presupuesto::jsonb;
ALTER TABLE ot ALTER COLUMN evidencia_urls TYPE jsonb USING evidencia_urls::jsonb;
