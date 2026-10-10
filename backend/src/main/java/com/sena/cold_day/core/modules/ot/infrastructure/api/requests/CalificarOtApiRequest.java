package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record CalificarOtApiRequest(
        @Min(1) @Max(5) int estrellas,
        @Size(max = 1000) String comentario) {

    public CalificarOtApiRequest {
        comentario = TextoPlano.limpiar(comentario);
    }
}
