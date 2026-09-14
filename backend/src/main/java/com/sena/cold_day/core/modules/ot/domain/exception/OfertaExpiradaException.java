package com.sena.cold_day.core.modules.ot.domain.exception;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;

/**
 * The 60-second offer window has closed (design D6 lazy check). Mapped to
 * HTTP 409: the accept is rejected and the OT is unaffected.
 */
public class OfertaExpiradaException extends RuntimeException {

    public OfertaExpiradaException(OfertaOtId id) {
        super("La oferta expiro antes de ser aceptada: " + id);
    }
}
