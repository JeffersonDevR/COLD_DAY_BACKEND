-- usuario.correo, tecnico.numero_identificacion y proveedor.nit son hoy
-- UNIQUE de tabla completa. Combinado con el soft-delete (activo=false), un
-- registro "eliminado" bloquea ese valor para siempre. Se reemplaza cada
-- UNIQUE por un índice único parcial (WHERE activo = true), mismo patrón que
-- ya usa el proyecto en el índice GiST parcial de tecnico
-- (idx_tecnico_disponible_ubicacion_geo). Es matemáticamente imposible que
-- esto falle por datos existentes: el nuevo índice es un subconjunto más
-- laxo del UNIQUE actual (ya no puede haber duplicados ni entre activos ni
-- entre inactivos). Los nombres reales de los constraints en Postgres no son
-- necesariamente los de schema.sql (nacieron del DDL de Hibernate), así que
-- se localizan dinámicamente en vez de asumirlos.

DO $$
DECLARE
    v_constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'usuario'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name = 'correo';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE usuario DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_usuario_correo_activo
    ON usuario (correo) WHERE activo = true;

DO $$
DECLARE
    v_constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'tecnico'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name = 'numero_identificacion';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE tecnico DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_tecnico_numero_identificacion_activo
    ON tecnico (numero_identificacion) WHERE activo = true;

DO $$
DECLARE
    v_constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'proveedor'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name = 'nit';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE proveedor DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_proveedor_nit_activo
    ON proveedor (nit) WHERE activo = true;
