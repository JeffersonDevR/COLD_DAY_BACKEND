package com.sena.cold_day.core.modules.clientes.infrastructure.api.requests;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Body of the second-profile acquisition endpoint {@code POST /api/clientes/perfil}.
 * <p>
 * It deliberately has <b>no {@code rol} field</b>: the endpoint is authenticated
 * but the created role must come only from the profile type (CLIENTE), so a
 * client-supplied {@code "rol":"ADMINISTRADOR"} must never influence authority
 * (M5). Jackson is not configured with {@code FAIL_ON_UNKNOWN_PROPERTIES}, so a
 * caller still sending a {@code rol} gets it silently ignored. The target
 * usuario is the authenticated principal — never a path id or body field.
 * {@code barrio} and {@code ubicacion} are optional.
 */
public record ClientePerfilApiRequest(
        @NotNull TipoCliente tipoCliente,
        @NotBlank String calle,
        @NotBlank String ciudad,
        String barrio,
        Point ubicacion) {

    public ClientePerfilApiRequest {
        calle = TextoPlano.limpiar(calle);
        ciudad = TextoPlano.limpiar(ciudad);
        barrio = TextoPlano.limpiar(barrio);
    }
}
