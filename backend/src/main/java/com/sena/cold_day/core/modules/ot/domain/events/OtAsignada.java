package com.sena.cold_day.core.modules.ot.domain.events;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Published once an offer wins the atomic cross-offer gate and the OT is
 * {@code ASIGNADA} (design D5). Unlike {@link EventoTerminalOt} it is not a
 * terminal event: the order continues through the repair lifecycle.
 */
public record OtAsignada(OtId otId, TecnicoId tecnicoId, ClienteId clienteId) {
}
