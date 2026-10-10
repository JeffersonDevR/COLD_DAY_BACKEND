package com.sena.cold_day.core.modules.administracion.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Rechazo del comprobante por el administrador (CU-13, flujo alterno 2a). */
public record RechazoLiquidacionApiRequest(
        @NotBlank @Size(max = 500) String motivo) {

    public RechazoLiquidacionApiRequest {
        motivo = TextoPlano.limpiar(motivo);
    }
}
