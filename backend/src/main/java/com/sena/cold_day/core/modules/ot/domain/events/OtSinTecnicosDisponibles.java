package com.sena.cold_day.core.modules.ot.domain.events;

import java.util.Optional;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/** Negative terminal state: no technician accepted at the maximum radius. */
public record OtSinTecnicosDisponibles(OtId otId, ClienteId clienteId) implements EventoTerminalOt {

    @Override
    public Optional<TecnicoId> tecnicoAsignado() {
        return Optional.empty();
    }
}
