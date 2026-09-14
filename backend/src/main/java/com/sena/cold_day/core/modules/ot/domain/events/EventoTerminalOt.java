package com.sena.cold_day.core.modules.ot.domain.events;

import java.util.Optional;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Common contract of the OT terminal events (RF-F1-27). The tracking
 * deactivation listener reacts to any of them; the assigned technician is
 * empty for the negative terminal state and for client cancellations before
 * assignment.
 */
public interface EventoTerminalOt {

    OtId otId();

    Optional<TecnicoId> tecnicoAsignado();
}
