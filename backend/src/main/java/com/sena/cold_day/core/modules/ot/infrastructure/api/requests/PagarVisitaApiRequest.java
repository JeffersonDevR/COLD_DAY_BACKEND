package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;

public record PagarVisitaApiRequest(@NotBlank String medioPago) {

    public PagarVisitaApiRequest {
        medioPago = TextoPlano.limpiar(medioPago);
    }
}
