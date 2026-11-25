package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.List;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.UbicacionDestinoInsumosException;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Resolves where an insumo request is delivered: the OT's service location, or
 * the assigned technician's last known location when the OT has none. With no
 * declared lines no request is created, so no destination is demanded.
 */
final class DestinoInsumos {

    private DestinoInsumos() {
    }

    static Point resolver(Ot ot, Tecnico tecnico, List<InsumoLinea> lineas) {
        if (ot.getUbicacion() != null) {
            return ot.getUbicacion();
        }
        if (lineas == null || lineas.isEmpty()) {
            return null;
        }
        if (tecnico.getUbicacion() != null) {
            return tecnico.getUbicacion();
        }
        throw new UbicacionDestinoInsumosException();
    }
}
