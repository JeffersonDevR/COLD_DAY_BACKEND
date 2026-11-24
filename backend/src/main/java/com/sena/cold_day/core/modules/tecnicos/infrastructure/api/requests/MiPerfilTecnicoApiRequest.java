package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Body of the self-service profile endpoint. {@code @NotEmpty} rejects both a
 * missing and an empty list at the API boundary; the aggregate keeps the same
 * rule as the last line of defence. {@code numeroIdentificacion} es opcional:
 * el registro ya no lo pide, asi que se completa aqui (null = no cambia).
 */
public record MiPerfilTecnicoApiRequest(
        @NotEmpty Set<CategoriaServicio> categoriasServicio,
        @Size(max = 255) String numeroIdentificacion) {

    public MiPerfilTecnicoApiRequest {
        numeroIdentificacion = TextoPlano.limpiar(numeroIdentificacion);
    }
}
