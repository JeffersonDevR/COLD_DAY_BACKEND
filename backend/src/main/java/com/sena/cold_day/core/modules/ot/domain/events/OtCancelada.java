package com.sena.cold_day.core.modules.ot.domain.events;

import java.util.Optional;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Terminal state reached by cancellation. {@code tecnicoId} is null when the OT
 * was cancelled before assignment (still {@code BUSCANDO_TECNICO}).
 */
public record OtCancelada(OtId otId, ActorOt canceladaPor, MotivoCancelacion motivo, TecnicoId tecnicoId)
        implements EventoTerminalOt {

    @Override
    public Optional<TecnicoId> tecnicoAsignado() {
        return Optional.ofNullable(tecnicoId);
    }
}
