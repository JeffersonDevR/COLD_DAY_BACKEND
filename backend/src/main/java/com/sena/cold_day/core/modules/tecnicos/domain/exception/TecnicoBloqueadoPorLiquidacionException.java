package com.sena.cold_day.core.modules.tecnicos.domain.exception;

/** El tecnico tiene comision sin consignar o sin aprobar (RF-F1-23). */
public class TecnicoBloqueadoPorLiquidacionException extends TecnicoAsignadoException {

    public TecnicoBloqueadoPorLiquidacionException() {
        super("Tienes comision pendiente por consignar. Envia la referencia y espera la aprobacion.", true);
    }
}
