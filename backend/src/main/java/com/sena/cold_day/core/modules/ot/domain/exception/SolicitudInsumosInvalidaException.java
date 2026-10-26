package com.sena.cold_day.core.modules.ot.domain.exception;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * The OT is in a lifecycle state where the assigned technician cannot raise a
 * parts request ("a posteriori" repuestos): before the technician is bound to
 * the order ({@code SOLICITADA}, {@code BUSCANDO_TECNICO}) or in a terminal
 * state ({@code FINALIZADA}, {@code CANCELADA}, {@code SIN_TECNICOS_DISPONIBLES}).
 * Mapped to 409: a conflict with the OT lifecycle, and nothing is written.
 */
public class SolicitudInsumosInvalidaException extends RuntimeException {

    public SolicitudInsumosInvalidaException(EstadoOt estado) {
        super("No se pueden solicitar insumos en el estado %s de la orden".formatted(estado));
    }
}
