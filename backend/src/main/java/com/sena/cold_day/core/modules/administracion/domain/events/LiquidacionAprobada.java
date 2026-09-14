package com.sena.cold_day.core.modules.administracion.domain.events;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;

/** El administrador aprobo el comprobante y el tecnico quedo desbloqueado (CU-13). */
public record LiquidacionAprobada(LiquidacionId liquidacionId) {
}
