-- Añade integridad referencial real en Postgres para las columnas UUID/Long
-- escalares que hoy solo se validan en el código de aplicación (decisión DDD
-- documentada en ARQUITECTURA.md: los módulos nunca usan @ManyToOne entre sí).
-- NOT VALID en todas: la constraint queda activa para todo INSERT/UPDATE
-- futuro desde el momento del deploy, pero Postgres NO escanea las filas
-- existentes, así que esta migración no puede fallar por datos huérfanos que
-- ya existan en producción. Validar cada una más adelante, cuando se hayan
-- revisado los datos reales, con:
--   ALTER TABLE <tabla> VALIDATE CONSTRAINT <nombre>;
-- (deliberadamente fuera de Flyway: un huérfano real no debe tumbar un deploy).

ALTER TABLE tecnico ADD CONSTRAINT fk_tecnico_usuario_id
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) NOT VALID;

ALTER TABLE clientes ADD CONSTRAINT fk_clientes_usuario_id
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) NOT VALID;

ALTER TABLE proveedor ADD CONSTRAINT fk_proveedor_usuario_id
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) NOT VALID;

ALTER TABLE documento_tecnico ADD CONSTRAINT fk_documento_tecnico_tecnico_id
    FOREIGN KEY (tecnico_id) REFERENCES tecnico(id) NOT VALID;

ALTER TABLE token_recuperacion ADD CONSTRAINT fk_token_recuperacion_usuario_id
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) NOT VALID;

ALTER TABLE ot ADD CONSTRAINT fk_ot_cliente_id
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) NOT VALID;

ALTER TABLE ot ADD CONSTRAINT fk_ot_tecnico_id
    FOREIGN KEY (tecnico_id) REFERENCES tecnico(id) NOT VALID;

ALTER TABLE ot_estado_historial ADD CONSTRAINT fk_ot_estado_historial_ot_id
    FOREIGN KEY (ot_id) REFERENCES ot(id) NOT VALID;

ALTER TABLE oferta_ot ADD CONSTRAINT fk_oferta_ot_ot_id
    FOREIGN KEY (ot_id) REFERENCES ot(id) NOT VALID;

ALTER TABLE oferta_ot ADD CONSTRAINT fk_oferta_ot_tecnico_id
    FOREIGN KEY (tecnico_id) REFERENCES tecnico(id) NOT VALID;

ALTER TABLE liquidacion ADD CONSTRAINT fk_liquidacion_ot_id
    FOREIGN KEY (ot_id) REFERENCES ot(id) NOT VALID;

ALTER TABLE liquidacion ADD CONSTRAINT fk_liquidacion_tecnico_id
    FOREIGN KEY (tecnico_id) REFERENCES tecnico(id) NOT VALID;

ALTER TABLE disputa ADD CONSTRAINT fk_disputa_ot_id
    FOREIGN KEY (ot_id) REFERENCES ot(id) NOT VALID;

ALTER TABLE requerimiento_insumo ADD CONSTRAINT fk_requerimiento_insumo_ot_id
    FOREIGN KEY (ot_id) REFERENCES ot(id) NOT VALID;

ALTER TABLE requerimiento_insumo ADD CONSTRAINT fk_requerimiento_insumo_tecnico_id
    FOREIGN KEY (tecnico_id) REFERENCES tecnico(id) NOT VALID;

ALTER TABLE oferta_insumo ADD CONSTRAINT fk_oferta_insumo_requerimiento_id
    FOREIGN KEY (requerimiento_id) REFERENCES requerimiento_insumo(id) NOT VALID;

ALTER TABLE oferta_insumo ADD CONSTRAINT fk_oferta_insumo_proveedor_id
    FOREIGN KEY (proveedor_id) REFERENCES proveedor(id) NOT VALID;
