package com.sena.cold_day.core.modules.ot.domain.events;

import java.util.Optional;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/** Positive terminal state: the assigned technician finished the repair. */
public record OtFinalizada(OtId otId, TecnicoId tecnicoId) implements EventoTerminalOt {

    @Override
    public Optional<TecnicoId> tecnicoAsignado() {
        return Optional.ofNullable(tecnicoId);
    }
}
