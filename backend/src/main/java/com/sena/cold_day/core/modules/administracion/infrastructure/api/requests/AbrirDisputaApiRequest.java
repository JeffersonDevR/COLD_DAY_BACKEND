package com.sena.cold_day.core.modules.administracion.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Apertura de disputa por el cliente (RF-F1-25). */
public record AbrirDisputaApiRequest(
        @NotBlank @Size(max = 1000) String motivo) {

    public AbrirDisputaApiRequest {
        motivo = TextoPlano.limpiar(motivo);
    }
}
