package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import java.util.List;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Parts request payload raised by the assigned technician outside the
 * diagnóstico flow (feature "repuestos a posteriori"). Unlike the diagnóstico
 * endpoint, the lines are mandatory here: an empty request raises nothing, so
 * the caller gets the canonical 400 instead of a silent no-op. The same wire
 * contract as the free-text diagnóstico lines is reused (AD5), and validation
 * is delegated to {@link InsumoLineaApiRequest}.
 */
public record InsumoSolicitudApiRequest(
        @Size(max = 1000) String observaciones,
        @NotEmpty @Valid List<InsumoLineaApiRequest> insumos) {

    public InsumoSolicitudApiRequest {
        observaciones = TextoPlano.limpiar(observaciones);
    }
}
