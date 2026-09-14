package com.sena.cold_day.core.modules.administracion.domain.exception;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;

/** La liquidacion solicitada no existe. Mapeada a HTTP 404 por el REST advice. */
public class LiquidacionNoEncontradaException extends RuntimeException {

    public LiquidacionNoEncontradaException(LiquidacionId id) {
        super("No se encontro la liquidacion con identificador: " + id.valor());
    }
}
