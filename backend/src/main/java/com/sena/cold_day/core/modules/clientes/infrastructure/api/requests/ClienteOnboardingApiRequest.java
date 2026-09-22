package com.sena.cold_day.core.modules.clientes.infrastructure.api.requests;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Alta pública de cliente: crea el Usuario (rol CLIENTE) y su perfil en una sola
 * transacción (mismo patrón que {@code /api/tecnicos}). Por eso incluye la
 * identidad y no un {@code usuarioId}.
 * {@code barrio} y {@code ubicacion} son opcionales.
 */
public record ClienteOnboardingApiRequest(
        @NotBlank String nombre,
        @NotBlank @Email String correo,
        @NotBlank String password,
        String telefono,
        String fotoUrl,
        @NotNull TipoCliente tipoCliente,
        @NotBlank String calle,
        @NotBlank String ciudad,
        String barrio,
        Point ubicacion,
        @NotNull Boolean aceptaHabeasData) {
}
