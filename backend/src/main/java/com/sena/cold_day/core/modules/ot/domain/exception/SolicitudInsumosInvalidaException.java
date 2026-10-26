package com.sena.cold_day.core.modules.ot.domain.exception;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * The OT is in a terminal lifecycle state ({@code FINALIZADA},
 * {@code CANCELADA}, {@code SIN_TECNICOS_DISPONIBLES}) where the assigned
 * technician can no longer raise a parts request ("a posteriori"
 * repuestos). Mapped to 409: a conflict with the OT lifecycle, and nothing
 * is written. The unbound states ({@code SOLICITADA},
 * {@code BUSCANDO_TECNICO}) never reach this exception: the
 * technician-ownership guard rejects them beforehand with 403.
 */
public class SolicitudInsumosInvalidaException extends RuntimeException {

    public SolicitudInsumosInvalidaException(EstadoOt estado) {
        super("No se pueden solicitar insumos en el estado %s de la orden".formatted(estado));
    }
}
