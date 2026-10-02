-- Metadatos de auditoria a nivel de fila para clientes, tecnico, ot y
-- proveedor: cuando se creo la fila, cuando se modifico por ultima vez y quien
-- hizo cada una de las dos cosas.
--
-- Por que las columnas son NULL y no se rellena retroactivamente: los datos de
-- auditoria solo existen para las filas escritas DESPUES de este cambio. Una
-- fila ya persistida no tiene quien la creo ni cuando se toco por ultima vez, y
-- fabricar un valor (por ejemplo la fecha de la migracion) seria mentir sobre la
-- historia del dato. Por eso no hay backfill: las filas historicas conservan
-- auditoria NULL y cualquier consulta futura tiene que tratar
-- `updated_at IS NULL` como "cambio anterior a la auditoria", no como dato
-- roto.
--
-- Por que created_by / last_modified_by NO son clave foranea a usuario: las
-- cuatro tablas de este proyecto usan UUID como clave propia y usuario.id es
-- bigint. Ademas una FK cruzaria el limite de modulo vertical (clientes,
-- tecnicos, ot y proveedores hacia usuarios) y la convencion del repositorio es
-- que las referencias entre modulos son columnas escalares sin restriccion
-- relacional. El valor guardado es texto, no una promesa de integridad
-- referencial.
--
-- Por que esta migracion es inseparables del mapeo de entidad: el proyecto
-- corre con `spring.jpa.hibernate.ddl-auto=validate` y
-- `spring.sql.init.mode=never`, asi que Hibernate nunca crea una columna. Si las
-- entidades declaran los campos de auditoria sin esta migracion, el
-- EntityManagerFactory falla la validacion de esquema y la aplicacion no
-- arranca. Si esta migracion llega sin las entidades, las columnas sobrantes
-- quedan inertes y el arranque es correcto. Por eso esta migracion y los cuatro
-- bloques de campos de auditoria van juntos en el mismo despliegue.
--
-- LIMITACION CONOCIDA Y ACEPTADA, NO ES UN ERROR: las escrituras masivas
-- `@Modifying @Query` en JPQL se van a la base de datos saltandose el ciclo de
-- vida de la entidad, por lo que NO refrescan updated_at ni last_modified_by.
-- Concretamente las escrituras sobre oferta_ot en EscalarRadioUseCase y
-- LimpiarOrdenesHuerfanasUseCase. oferta_ot no es una de las cuatro tablas de
-- esta migracion y corregirlo exigiria refactorizar rutas de escritura
-- existentes, fuera del alcance de este cambio. Esta nota existe para que un
-- mantenedor futuro no lo lea como un defecto a arreglar aqui.
--
-- Sentencias planas (sin IF NOT EXISTS), igual que V2/V3/V4/V7: Flyway versiona
-- por checksum y nunca re-corre una migracion aplicada.

-- ------------------------------------------------------------------ clientes --
ALTER TABLE clientes ADD COLUMN created_at timestamp(6) with time zone;
ALTER TABLE clientes ADD COLUMN updated_at timestamp(6) with time zone;
ALTER TABLE clientes ADD COLUMN created_by character varying(255);
ALTER TABLE clientes ADD COLUMN last_modified_by character varying(255);

-- ------------------------------------------------------------------- tecnico --
ALTER TABLE tecnico ADD COLUMN created_at timestamp(6) with time zone;
ALTER TABLE tecnico ADD COLUMN updated_at timestamp(6) with time zone;
ALTER TABLE tecnico ADD COLUMN created_by character varying(255);
ALTER TABLE tecnico ADD COLUMN last_modified_by character varying(255);

-- ------------------------------------------------------------------------ ot --
ALTER TABLE ot ADD COLUMN created_at timestamp(6) with time zone;
ALTER TABLE ot ADD COLUMN updated_at timestamp(6) with time zone;
ALTER TABLE ot ADD COLUMN created_by character varying(255);
ALTER TABLE ot ADD COLUMN last_modified_by character varying(255);

-- ----------------------------------------------------------------- proveedor --
ALTER TABLE proveedor ADD COLUMN created_at timestamp(6) with time zone;
ALTER TABLE proveedor ADD COLUMN updated_at timestamp(6) with time zone;
ALTER TABLE proveedor ADD COLUMN created_by character varying(255);
ALTER TABLE proveedor ADD COLUMN last_modified_by character varying(255);

-- ------------------------------------------------------------------- comments --
-- Los *_by guardan el identificador del usuario autenticado como texto, o el
-- literal 'system' cuando la escritura no tenia contexto de seguridad (los jobs
-- @Scheduled, el seeder de desarrollo y las escrituras de test). La columna es
-- texto y NO una clave foranea a usuario de forma intencional: las cuatro tablas
-- usan UUID como clave propia, usuario.id es bigint, y una FK cruzaria el limite
-- de modulo vertical.
--
-- Los *_at son instantes de auditoria de la fila, provistos por el
-- DateTimeProvider de Spring Data JPA. Son DISTINTOS de los timestamps de
-- NEGOCIO: ot.creada_en, proveedor.creado_en y
-- tecnico.ubicacion_actualizada_en registran cuando ocurrio el hecho de negocio
-- y los gobierna el bean Clock del proyecto, nunca el DateTimeProvider.

COMMENT ON COLUMN clientes.created_by IS
    'Identificador del usuario autenticado que creo la fila, o ''system'' si la escritura no tenia contexto de seguridad. Texto, sin clave foranea intencional a usuario.';
COMMENT ON COLUMN clientes.last_modified_by IS
    'Identificador del usuario autenticado que modifico la fila por ultima vez, o ''system''. Texto, sin clave foranea intencional a usuario.';
COMMENT ON COLUMN clientes.created_at IS
    'Instante de auditoria de creacion (DateTimeProvider de Spring Data JPA). Distinto de los timestamps de negocio como ot.creada_en.';
COMMENT ON COLUMN clientes.updated_at IS
    'Instante de auditoria de ultima modificacion (DateTimeProvider). NULL en filas anteriores a V10: no hay backfill.';

COMMENT ON COLUMN tecnico.created_by IS
    'Identificador del usuario autenticado que creo la fila, o ''system'' si la escritura no tenia contexto de seguridad. Texto, sin clave foranea intencional a usuario.';
COMMENT ON COLUMN tecnico.last_modified_by IS
    'Identificador del usuario autenticado que modifico la fila por ultima vez, o ''system''. Texto, sin clave foranea intencional a usuario.';
COMMENT ON COLUMN tecnico.created_at IS
    'Instante de auditoria de creacion (DateTimeProvider de Spring Data JPA). Distinto de tecnico.ubicacion_actualizada_en, que es tiempo de negocio.';
COMMENT ON COLUMN tecnico.updated_at IS
    'Instante de auditoria de ultima modificacion (DateTimeProvider). NULL en filas anteriores a V10: no hay backfill.';

COMMENT ON COLUMN ot.created_by IS
    'Identificador del usuario autenticado que creo la fila, o ''system'' si la escritura no tenia contexto de seguridad. Texto, sin clave foranea intencional a usuario.';
COMMENT ON COLUMN ot.last_modified_by IS
    'Identificador del usuario autenticado que modifico la fila por ultima vez, o ''system''. Texto, sin clave foranea intencional a usuario.';
COMMENT ON COLUMN ot.created_at IS
    'Instante de auditoria de creacion (DateTimeProvider de Spring Data JPA). Distinto de ot.creada_en, que es el instante de negocio fijado por el bean Clock.';
COMMENT ON COLUMN ot.updated_at IS
    'Instante de auditoria de ultima modificacion (DateTimeProvider). NULL en filas anteriores a V10: no hay backfill.';

COMMENT ON COLUMN proveedor.created_by IS
    'Identificador del usuario autenticado que creo la fila, o ''system'' si la escritura no tenia contexto de seguridad. Texto, sin clave foranea intencional a usuario.';
COMMENT ON COLUMN proveedor.last_modified_by IS
    'Identificador del usuario autenticado que modifico la fila por ultima vez, o ''system''. Texto, sin clave foranea intencional a usuario.';
COMMENT ON COLUMN proveedor.created_at IS
    'Instante de auditoria de creacion (DateTimeProvider de Spring Data JPA). Distinto de proveedor.creado_en, que es tiempo de negocio.';
COMMENT ON COLUMN proveedor.updated_at IS
    'Instante de auditoria de ultima modificacion (DateTimeProvider). NULL en filas anteriores a V10: no hay backfill.';
