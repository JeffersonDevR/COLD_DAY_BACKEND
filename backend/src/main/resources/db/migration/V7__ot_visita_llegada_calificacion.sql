-- Soporte de persistencia de las tres caras de la OT que hoy solo viven en
-- memoria: confirmacion de llegada, pago de la tarifa de visita y
-- calificacion del tecnico.
--
-- Regla dura de este refactor: ningun campo de dominio sin columna. Un campo
-- en memoria que la tabla no guarda se resetea en cada lectura, es decir
-- data loss silenciosa. Por eso cada invariante nueva de Ot.java
-- (confirmarLlegada / registrarPagoVisita / calificar) tiene columna, mapeo
-- JPA y sobrecarga de reconstitucion.
--
-- V1__baseline_esquema_actual.sql es snapshot y usa
-- spring.flyway.baseline-on-migrate con baseline-version=1, asi que NO se
-- re-corre en bases ya baselined. Toda columna nueva va aqui.
--
-- Sentencias planas (sin IF NOT EXISTS), igual que V2/V3/V4: Flyway versiona
-- por checksum y nunca re-corre una migracion aplicada.

-- ---------------------------------------------------------------- llegada --
-- Hecho, no transicion: confirmarLlegada NO cambia el estado de la OT (la
-- maquina de estados de SRS 5.2 no tiene un estado EN_LLEGADO), por eso no
-- genera entrada en ot_estado_historial.
ALTER TABLE ot ADD COLUMN llegada_en timestamp(6) with time zone;

-- ------------------------------------------------------------- pago visita --
-- El medio de pago lo registra el CLIENTE al pagar la tarifa de visita
-- (RF-F1-26): PagarVisitaUseCase resuelve el perfil del cliente y valida que
-- sea dueno de la OT antes de cobrar. El pagador es el cliente, no el
-- tecnico, asi que aqui NO se congela ningun snapshot del tecnico para el
-- pago: el cobro se atribuye a la orden, no a una persona.
ALTER TABLE ot ADD COLUMN medio_pago_visita character varying(30);
ALTER TABLE ot ADD COLUMN visita_pagada_en timestamp(6) with time zone;

-- ----------------------------------------------------------- calificacion --
-- RF-F1-15: el cliente califica al TECNICO con escala de 1 a 5 estrellas y
-- comentario cualitativo, recalculando su reputacion publica. La calificacion
-- es sobre una persona, no sobre la orden, por eso se congela el tecnico
-- calificado: si la OT se reasigna, la calificacion sigue apuntando a quien
-- la recibio.
ALTER TABLE ot ADD COLUMN calificacion_estrellas integer;
ALTER TABLE ot ADD COLUMN calificacion_comentario character varying(1000);
ALTER TABLE ot ADD COLUMN calificacion_en timestamp(6) with time zone;
ALTER TABLE ot ADD COLUMN calificacion_tecnico_id uuid;

ALTER TABLE ot ADD CONSTRAINT fk_ot_calificacion_tecnico_id
    FOREIGN KEY (calificacion_tecnico_id) REFERENCES tecnico(id) ON DELETE SET NULL NOT VALID;

-- La escala de RF-F1-15 es 1..5. NULL significa "no calificada todavia", que
-- es legal; lo ilegal es una estrella fuera de rango.
ALTER TABLE ot ADD CONSTRAINT ot_calificacion_estrellas_check
    CHECK ((calificacion_estrellas IS NULL OR (calificacion_estrellas BETWEEN 1 AND 5)));

-- ------------------------------------------------- motivo de cancelacion --
-- LimpiarOrdenesHuerfanasUseCase cancela con ActorOt.SISTEMA /
-- MotivoCancelacion.LIMPIEZA_SISTEMA, un valor que el CHECK de V1 no permite.
-- Postgres no tiene ADD CONSTRAINT ... REPLACE sobre un CHECK ya validado, asi
-- que se dropea y se recrea. Lo unico que este CHECK verifica es que el valor
-- pertenezca al enum de dominio, que sigue siendo la unica fuente de verdad.
ALTER TABLE ot DROP CONSTRAINT ot_motivo_cancelacion_check;

ALTER TABLE ot ADD CONSTRAINT ot_motivo_cancelacion_check
    CHECK (((motivo_cancelacion)::text = ANY ((ARRAY['CANCELACION_CLIENTE'::character varying, 'CANCELACION_TECNICO'::character varying, 'RECHAZO_PRESUPUESTO'::character varying, 'RESOLUCION_DISPUTA_SIN_ACUERDO'::character varying, 'LIMPIEZA_SISTEMA'::character varying])::text[])));