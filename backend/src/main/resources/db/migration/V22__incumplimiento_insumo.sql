-- ETA incumplido (diseno 2026-11-26): el tecnico puede cambiar de proveedor.
-- La oferta ganadora que pierde el pedido queda REEMPLAZADA y se registra el
-- incumplimiento. No hay sanciones: la tabla es solo de consulta.

ALTER TABLE oferta_insumo DROP CONSTRAINT oferta_insumo_estado_check;
ALTER TABLE oferta_insumo ADD CONSTRAINT oferta_insumo_estado_check
    CHECK (estado::text = ANY (ARRAY['PENDIENTE', 'ACEPTADA', 'RECHAZADO', 'EXPIRADA', 'CANCELADA',
                                     'REEMPLAZADA']::text[]));

CREATE TABLE incumplimiento_insumo (
    id               uuid PRIMARY KEY,
    requerimiento_id uuid NOT NULL REFERENCES requerimiento_insumo (id),
    proveedor_id     uuid NOT NULL REFERENCES proveedor (id),
    eta_minutos      integer NOT NULL,
    aceptada_en      timestamptz NOT NULL,
    reemplazado_en   timestamptz NOT NULL
);

CREATE INDEX idx_incumplimiento_proveedor ON incumplimiento_insumo (proveedor_id);
CREATE INDEX idx_incumplimiento_reemplazado_en ON incumplimiento_insumo (reemplazado_en DESC);
