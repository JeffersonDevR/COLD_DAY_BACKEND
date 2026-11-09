-- V16 — Contador por año para el código legible de la OT (OT-YYYY-####).
--
-- Antes el número se calculaba con MAX(split_part(codigo,'-',3)) dentro de la
-- transacción de creación. Dos problemas:
--   1. MAX() sobre una expresión no puede usar idx_ot_codigo y la consulta filtra
--      con LIKE: cada creación escaneaba la tabla completa de OT.
--   2. Dos creaciones concurrentes del mismo año calculaban el mismo número; la
--      perdedora fallaba contra el índice único (409 espurio para el usuario).
--
-- El contador lo resuelve de raíz: un UPSERT atómico devuelve un número distinto a
-- cada transacción. El índice único de V14 sigue ahí como red de seguridad.

CREATE TABLE IF NOT EXISTS ot_secuencia_anio (
    anio integer PRIMARY KEY,
    ultimo integer NOT NULL DEFAULT 0,
    CONSTRAINT chk_ot_secuencia_no_negativa CHECK (ultimo >= 0)
);

-- Sembrado con lo ya emitido, para no repetir números en bases existentes.
-- Solo cuentan los códigos con la forma exacta; cualquier código editado a mano
-- queda fuera (y el índice único lo sigue cubriendo).
INSERT INTO ot_secuencia_anio (anio, ultimo)
SELECT split_part(codigo, '-', 2)::integer AS anio,
       MAX(split_part(codigo, '-', 3)::bigint)::integer AS ultimo
FROM ot
WHERE codigo ~ '^OT-[0-9]{4}-[0-9]{1,9}$'
GROUP BY split_part(codigo, '-', 2)::integer
ON CONFLICT (anio) DO NOTHING;
