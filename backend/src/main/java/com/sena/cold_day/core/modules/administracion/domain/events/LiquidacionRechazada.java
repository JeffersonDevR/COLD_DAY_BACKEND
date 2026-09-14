package com.sena.cold_day.core.modules.administracion.domain.events;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;

/** El administrador rechazo el comprobante; el tecnico sigue bloqueado (CU-13, 2a). */
public record LiquidacionRechazada(LiquidacionId liquidacionId, String motivo) {
}
