package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Size;

/** Optional free-text reason for rejecting a presented budget (RF-F1-20). */
public record RechazoPresupuestoApiRequest(
        @Size(max = 500) String motivo) {

    public RechazoPresupuestoApiRequest {
        motivo = TextoPlano.limpiar(motivo);
    }
}
