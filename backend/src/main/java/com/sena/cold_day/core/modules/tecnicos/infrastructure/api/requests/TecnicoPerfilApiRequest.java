package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

/**
 * Body of the second-profile acquisition endpoint {@code POST /api/tecnicos/perfil}.
 * <p>
 * It deliberately has <b>no {@code rol} field</b>: the endpoint is authenticated
 * but the created role must come only from the profile type (TECNICO), so a
 * client-supplied {@code "rol":"ADMINISTRADOR"} must never influence authority
 * (M5). Jackson is not configured with {@code FAIL_ON_UNKNOWN_PROPERTIES}, so a
 * caller still sending a {@code rol} gets it silently ignored. The target
 * usuario is the authenticated principal — never a path id or body field.
 */
public record TecnicoPerfilApiRequest(
        @NotBlank String numeroIdentificacion,
        @NotEmpty Set<CategoriaServicio> categoriasServicio,
        Set<Certificacion> certificaciones) {

    public TecnicoPerfilApiRequest {
        numeroIdentificacion = TextoPlano.limpiar(numeroIdentificacion);
    }
}
