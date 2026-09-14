package com.sena.cold_day.core.modules.administracion.infrastructure.api.requests;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Carga de la foto del comprobante de consignacion bancaria (RF-F1-24). */
public record ComprobanteApiRequest(
        @NotBlank @Size(max = 1000) String comprobanteUrl) {
}
