-- ACTA DE GARANTIA FIRMADA por el cliente sobre una OT FINALIZADA.
--
-- Por que existe esta migracion: la UI de liquidacion (pago-acta-page) ofrecia al
-- cliente "Descargar Acta de Garantia Firmada" y un "Codigo de verificacion:
-- CD-SEC-<id de la OT>" que se fabricaba en el template. No habia ninguna
-- llamada de red: la firma dibujada en el <canvas> se descartaba al hacer
-- click. Bajo la Ley 1480 ese documento es la prueba del consumidor de 90 dias
-- de garantia, y un exito falso es peor que un 404 porque el cliente se va
-- creyendo que tiene un documento que nadie guardo.
--
-- Por que columnas propias y no una entrada mas en ot.evidencia_urls:
-- evidencia_urls es la evidencia fotografica de la falla, capturada al abrir la
-- orden, y su semantica es "URL de un recurso externo". El acta es otra cosa:
-- tiene ciclo de vida propio (se firma una vez, sobre una FINALIZADA, con un
-- instante de firma y un codigo de verificacion que se emite y se consulta),
-- su contenido es un data URL de la firma del cliente, no una URL, y mezclarla
-- con la evidencia contaminaria ambas: la evidencia dejaria de ser evidencia y
-- el acta perderia el codigo y la fecha que la hacen verificable. La regla
-- dura del proyecto (ver V7) sigue igual: ningun campo de dominio sin columna.
--
-- Por que el codigo NO se deriva del id de la OT: un codigo verificable que se
-- calcula con los datos publicos de la orden (el UUID es el path de la API)
-- no verifica nada, solo se ve authentico. Lo emite SecureRandom en el
-- servidor y se persiste; el indice unico parcial de abajo convierte la
-- unicidad en una invariante de la base, no de la aplicacion.
--
-- Por que las columnas son NULL y no hay backfill: solo las ordenes firmadas
-- DESPUES de este deploy tienen acta. Una orden ya persistida no fue firmada y
-- fabricar un codigo o una fecha seria mentir sobre la historia del dato, igual
-- que decidio V10 con los metadatos de auditoria.
--
-- Por que esta migracion y el mapeo de OtJpaEntity van juntos: el proyecto
-- corre con `spring.jpa.hibernate.ddl-auto=validate` y
-- `spring.sql.init.mode=never`, asi que Hibernate nunca crea una columna. Si
-- la entidad declara los campos sin esta migracion el arranque falla; si la
-- migracion llega sin la entidad, las columnas quedan inertes.
--
-- Sentencias planas (sin IF NOT EXISTS), igual que V2/V3/V4/V7: Flyway
-- versiona por checksum y nunca re-corre una migracion aplicada.

ALTER TABLE ot ADD COLUMN acta_firma_data_url text;
ALTER TABLE ot ADD COLUMN acta_codigo_verificacion character varying(32);
ALTER TABLE ot ADD COLUMN acta_firmada_en timestamp(6) with time zone;

-- Unicidad del codigo como invariante de la base, no de la aplicacion: dos
-- actas distintas nunca pueden compartir el mismo codigo de verificacion.
-- Parcial porque hasta la primera firma la columna es NULL para todo el mundo
-- y en SQL NULL != NULL, asi que un indice UNIQUE plano tambien lo permitiria;
-- el parcial documenta que la unicidad solo aplica a las actas emitidas.
CREATE UNIQUE INDEX idx_ot_acta_codigo_verificacion
    ON ot (acta_codigo_verificacion)
    WHERE acta_codigo_verificacion IS NOT NULL;

-- El acta es de las tres caras de la OT que solo viven hoy en el PDF que el
-- cliente se lleva. La firma es la del cliente dueno de la orden (la
-- MONETIZACION no cambia), asi que no se congela snapshot de persona aqui:
-- el tecnico que dio la garantia ya esta en ot.tecnico_id y la OT FINALIZADA
-- es terminal, no admite reasignacion.
COMMENT ON COLUMN ot.acta_firma_data_url IS
    'Firma del cliente como data URL (base64) del canvas de la acta de garantia. NULL mientras la OT no este FINALIZADA y firmada. No es una URL de recurso: es el contenido del documento.';
COMMENT ON COLUMN ot.acta_codigo_verificacion IS
    'Codigo de verificacion emitido por el servidor con SecureRandom al firmar el acta. Unico (idx_ot_acta_codigo_verificacion) y nunca derivado del id de la OT.';
COMMENT ON COLUMN ot.acta_firmada_en IS
    'Instante de NEGOCIO de la firma del acta (bean Clock), no metadato de auditoria. Es el origen de los 90 dias calendario de garantia bajo la Ley 1480.';
