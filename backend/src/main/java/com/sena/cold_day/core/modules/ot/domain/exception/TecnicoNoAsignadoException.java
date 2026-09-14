package com.sena.cold_day.core.modules.ot.domain.exception;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * The authenticated technician is not the one assigned to the OT (RF-F1-11).
 * Mapped to 403: the caller is authenticated but not authorized for this order.
 */
public class TecnicoNoAsignadoException extends RuntimeException {

    public TecnicoNoAsignadoException(OtId otId, TecnicoId tecnicoId) {
        super("El tecnico %s no esta asignado a la orden %s".formatted(tecnicoId, otId));
    }
}
