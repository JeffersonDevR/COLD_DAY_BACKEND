package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;

/** Cuerpo opcional al cerrar el servicio: como le pago el cliente al tecnico. */
public record FinalizarOtApiRequest(MedioPago medioPago) {
}
