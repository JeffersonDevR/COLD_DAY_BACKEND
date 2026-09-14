package com.sena.cold_day.core.modules.ot.domain.exception;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * The authenticated client does not own the OT being acted on (RF-F1-20).
 * Mapped to 403: the caller is authenticated but not authorized for this order.
 */
public class OtAccesoNoPermitidoException extends RuntimeException {

    public OtAccesoNoPermitidoException(OtId otId) {
        super("El usuario autenticado no tiene permiso sobre la orden " + otId);
    }
}
