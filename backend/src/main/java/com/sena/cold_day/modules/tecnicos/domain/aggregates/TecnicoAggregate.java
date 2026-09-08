package com.sena.cold_day.modules.tecnicos.domain.aggregates;

import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;

/** Marker type documenting that Tecnico is the technician aggregate root. */
public final class TecnicoAggregate {

    private TecnicoAggregate() {
    }

    public static Tecnico root() {
        return new Tecnico();
    }
}
