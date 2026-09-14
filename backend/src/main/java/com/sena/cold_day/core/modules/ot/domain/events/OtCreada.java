package com.sena.cold_day.core.modules.ot.domain.events;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/** Published when a client creates an OT and dispatch starts (RF-F1-08). */
public record OtCreada(OtId otId, ClienteId clienteId) {
}
