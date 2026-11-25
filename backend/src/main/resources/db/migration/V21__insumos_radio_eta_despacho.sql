-- Difusion de insumos por radio, ETA comprometido y paso de despacho.
-- Todas las columnas nuevas son nulables: las filas previas (sin radio ni ETA)
-- siguen siendo validas; el barrido de escalado las ignora y vencen como antes.

ALTER TABLE requerimiento_insumo
    ADD COLUMN radio_km          double precision,
    ADD COLUMN ventana_expira_en timestamptz,
    ADD COLUMN destino_latitud   double precision,
    ADD COLUMN destino_longitud  double precision,
    ADD COLUMN eta_minutos       integer,
    ADD COLUMN distancia_km      double precision,
    ADD COLUMN aceptada_en       timestamptz,
    ADD COLUMN despachada_en     timestamptz,
    ADD COLUMN eta_aviso_en      timestamptz;

ALTER TABLE oferta_insumo
    ADD COLUMN distancia_km          double precision,
    ADD COLUMN eta_sugerido_minutos  integer;

-- El estado DESPACHADO no estaba en el check original (V1).
ALTER TABLE requerimiento_insumo DROP CONSTRAINT requerimiento_insumo_estado_check;
ALTER TABLE requerimiento_insumo ADD CONSTRAINT requerimiento_insumo_estado_check
    CHECK (estado::text = ANY (ARRAY['SOLICITADO', 'ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'SIN_PROVEEDOR']::text[]));

-- Barrido de escalado: solo requerimientos abiertos con radio definido.
CREATE INDEX IF NOT EXISTS idx_req_insumo_escalable
    ON requerimiento_insumo (ventana_expira_en)
    WHERE estado = 'SOLICITADO' AND radio_km IS NOT NULL;

-- Aviso de ETA vencido: asignados sin aviso previo.
CREATE INDEX IF NOT EXISTS idx_req_insumo_eta_pendiente
    ON requerimiento_insumo (aceptada_en)
    WHERE estado = 'ASIGNADO' AND eta_aviso_en IS NULL;
