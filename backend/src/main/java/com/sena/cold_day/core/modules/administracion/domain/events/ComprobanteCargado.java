package com.sena.cold_day.core.modules.administracion.domain.events;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;

/** El tecnico cargo la foto del comprobante de consignacion (RF-F1-24). */
public record ComprobanteCargado(LiquidacionId liquidacionId) {
}
