package com.sena.cold_day.core.modules.administracion.domain.exception;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;

/** La disputa solicitada no existe. Mapeada a HTTP 404 por el REST advice. */
public class DisputaNoEncontradaException extends RuntimeException {

    public DisputaNoEncontradaException(DisputaId id) {
        super("No se encontro la disputa con identificador: " + id.valor());
    }
}
