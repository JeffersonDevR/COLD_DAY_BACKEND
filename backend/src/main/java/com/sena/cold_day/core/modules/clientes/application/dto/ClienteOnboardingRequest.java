package com.sena.cold_day.core.modules.clientes.application.dto;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Onboarding de cliente (Usuario + perfil) en una sola operación, análogo a
 * {@code RegistrarTecnicoUseCase}. Incluye la identidad porque el endpoint es
 * público y no depende de un principal autenticado.
 */
public record ClienteOnboardingRequest(
        String nombre,
        String correo,
        String password,
        String telefono,
        String fotoUrl,
        TipoCliente tipoCliente,
        String calle,
        String ciudad,
        String barrio,
        Point ubicacion,
        boolean aceptaHabeasData) {
}
