-- V20 - El registro ya no pide datos de servicio: cedula (tecnico) y razon
-- social/NIT (proveedor) se completan despues, dentro de la app.
--
-- Los indices unicos (tecnico_numero_identificacion_key, proveedor_nit_key y los
-- parciales de V3) siguen vigentes: Postgres admite varios NULL en un unico.
--
-- Append-only: V1-V19 no se tocan.

ALTER TABLE tecnico ALTER COLUMN numero_identificacion DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN razon_social DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN nit DROP NOT NULL;
