package com.sena.cold_day.core.modules.ot.domain.exception;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/** The requested OT does not exist. Mapped to HTTP 404 by the REST advice. */
public class OtNoEncontradoException extends RuntimeException {

    public OtNoEncontradoException(OtId id) {
        super("No se encontro la orden de trabajo con identificador: " + id.valor());
    }
}
