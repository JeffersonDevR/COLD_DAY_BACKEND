package com.sena.cold_day.core.modules.administracion.infrastructure.api.requests;

import java.math.BigDecimal;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/**
 * Registro manual del cobro al cierre de la OT (RF-F1-26). El tecnico declara
 * monto y medio recibidos del cliente antes del calculo de la comision.
 */
public record RegistrarPagoApiRequest(
        @NotNull @DecimalMin(value = "0.01", message = "debe ser positivo") BigDecimal montoCobrado,
        @NotNull MedioPago medioPago) {
}
