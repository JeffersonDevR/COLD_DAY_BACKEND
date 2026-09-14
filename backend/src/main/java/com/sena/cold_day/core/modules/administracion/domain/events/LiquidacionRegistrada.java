package com.sena.cold_day.core.modules.administracion.domain.events;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;

/** El tecnico registro el cobro en efectivo/transferencia (RF-F1-26) y quedo bloqueado. */
public record LiquidacionRegistrada(LiquidacionId liquidacionId) {
}
