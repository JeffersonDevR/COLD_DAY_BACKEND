package com.sena.cold_day.core.modules.clientes.infrastructure.api.requests;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Client onboarding request (carried decision D6): the principal identifies the
 * usuario, so there is deliberately no {@code usuarioId} field in the body.
 * {@code barrio} and {@code ubicacion} are optional.
 */
public record ClienteApiRequest(
        @NotNull TipoCliente tipoCliente,
        @NotBlank String calle,
        @NotBlank String ciudad,
        String barrio,
        Point ubicacion) {
}
