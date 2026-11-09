-- V15 — Indices y constraints que faltaban para consultas que YA existen.
--
-- Aditiva y sin cambios de datos. Contexto completo (camino caliente -> query ->
-- indice) en odd/audits/2026-11-09-auditoria-fallas-fugas-arquitectura.md, §7.
--
-- Antes de aplicar en produccion conviene verificar el inventario real
-- (SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '...') y, si las
-- tablas son grandes, crear los indices con CREATE INDEX CONCURRENTLY fuera de
-- Flyway (CONCURRENTLY no puede correr dentro de la transaccion de la migracion).
-- Todos usan IF NOT EXISTS, asi que repetirlos a mano no rompe nada.

-- ---------------------------------------------------------------------------
-- A7: el indice espacial del radar vivia SOLO en V1, que no se ejecuta en una
-- base baselineada (baseline-on-migrate + baseline-version=1). Hibernate no puede
-- crearlo porque es funcional y parcial. Sin el, cada busqueda de despacho hace
-- sequential scan de `tecnico` + calculo de distancia fila a fila.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tecnico_disponible_ubicacion_geo
    ON tecnico USING GIST ((ST_MakePoint(longitud, latitud)::geography))
    WHERE activo = true
      AND estado_validacion = 'APROBADO'
      AND estado_operativo = 'DISPONIBLE';

-- ---------------------------------------------------------------------------
-- A8: el UNIQUE parcial de V3 (WHERE activo = true) no sirve a findByCorreo, que
-- no filtra por activo: PostgreSQL no usa un indice parcial si la consulta no
-- implica su predicado. Cada login era un seq scan sobre `usuario`.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_usuario_correo ON usuario (correo);

-- ---------------------------------------------------------------------------
-- A13: el barrido de ofertas de insumos (cada 60 s) filtraba por estado+fecha sin
-- ningun indice, sobre una tabla que nunca se purga.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_oferta_insumo_pendiente_expira
    ON oferta_insumo (expira_en)
    WHERE estado = 'PENDIENTE';

-- ---------------------------------------------------------------------------
-- A14: FK sin indice en el lado referenciante + @OneToMany EAGER: Hibernate emite
-- un SELECT ... WHERE requerimiento_id = ? por cada solicitud cargada.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_req_insumo_item_requerimiento
    ON requerimiento_insumo_item (requerimiento_id);

-- ---------------------------------------------------------------------------
-- A9/A15: barrido de escalamiento (cada 5 s) y limpieza de huerfanas por estado.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ot_buscando_ventana
    ON ot (ventana_expira_en)
    WHERE estado = 'BUSCANDO_TECNICO';

CREATE INDEX IF NOT EXISTS idx_ot_estado_tecnico ON ot (estado, tecnico_id);

-- ---------------------------------------------------------------------------
-- Listados por cliente/tecnico con orden (hoy no tienen ORDER BY ni paginacion;
-- el indice deja barato cuando se anadan).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ot_cliente_creada ON ot (cliente_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_ot_tecnico_creada ON ot (tecnico_id, creada_en DESC);

-- ---------------------------------------------------------------------------
-- Bandejas por estado dentro de un perfil.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_oferta_ot_tecnico_estado ON oferta_ot (tecnico_id, estado);
CREATE INDEX IF NOT EXISTS idx_oferta_insumo_proveedor_estado ON oferta_insumo (proveedor_id, estado);

-- ---------------------------------------------------------------------------
-- FKs sin indice de soporte (revisadas una a una: solo faltaban estas dos en V2/V7;
-- la tercera, requerimiento_insumo_item, va arriba).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_req_insumo_tecnico_id ON requerimiento_insumo (tecnico_id);

CREATE INDEX IF NOT EXISTS idx_ot_calificacion_tecnico
    ON ot (calificacion_tecnico_id)
    WHERE calificacion_tecnico_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- B3: unicidad de negocio que hoy solo se garantiza en memoria (check-then-act).
-- Se comprueba primero que no haya duplicados existentes: si los hay, la
-- migracion se detiene con un mensaje accionable en vez de fallar con un error
-- opaco de Postgres a mitad de la creacion del indice.
--
-- NOTA sobre oferta_ot: NO se crea un unico parcial (ot_id, tecnico_id) WHERE
-- estado='PENDIENTE'. La expiracion de las ofertas es PEREZOSA: una oferta con
-- la ventana vencida sigue en estado PENDIENTE hasta que la barre el sweep, de
-- modo que "PENDIENTE + vencida" es un estado legitimo y puede coexistir con una
-- nueva oferta al mismo tecnico. Un predicado de indice no puede expresar
-- "y ademas no vencida" porque now() no es inmutable. Si se quiere cerrar la
-- carrera de duplicados, la via es que el sweep expire antes de reofertar (ya lo
-- hace) y que ofrecer() sea condicional por (ot, tecnico).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM disputa WHERE estado = 'ABIERTA' GROUP BY ot_id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'V15: hay mas de una disputa ABIERTA para la misma OT. Resuelve los duplicados y reaplica.';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_disputa_abierta_por_ot
    ON disputa (ot_id)
    WHERE estado = 'ABIERTA';

-- ---------------------------------------------------------------------------
-- B3: auxiliares no puede ser negativo (columna NOT NULL con DEFAULT 0).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ot_auxiliares_no_negativos') THEN
        ALTER TABLE ot ADD CONSTRAINT chk_ot_auxiliares_no_negativos
            CHECK (auxiliares_requeridos >= 0);
    END IF;
END $$;
