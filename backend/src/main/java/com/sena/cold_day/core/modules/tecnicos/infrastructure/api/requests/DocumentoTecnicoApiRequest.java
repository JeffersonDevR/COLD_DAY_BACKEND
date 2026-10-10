package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;

public record DocumentoTecnicoApiRequest(
        @NotBlank String tipo,
        java.time.LocalDate fechaVencimiento) {

    public DocumentoTecnicoApiRequest {
        tipo = TextoPlano.limpiar(tipo);
    }
}
