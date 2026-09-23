package com.sena.cold_day.core.modules.proveedores.domain.exception;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;

/**
 * A dispatch offer cannot be acted on right now: it is unknown, belongs to
 * another supplier, was already resolved, its window closed, or it lost the
 * atomic first-accept gate (spec disp.R3/R4/R5, design D4/D5). Mapped to HTTP
 * 409 (the same conflict the losing supplier receives) once the API surface
 * exists (slice 11).
 */
public class OfertaInsumoNoDisponibleException extends RuntimeException {

    public OfertaInsumoNoDisponibleException(OfertaInsumoId id) {
        super("La oferta de insumos no esta disponible: " + id);
    }
}
