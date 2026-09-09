package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record TecnicoApiRequest(
        @NotBlank String nombre,
        @Email String correo,
        @NotBlank String password,
        String telefono,
        @NotBlank String numeroIdentificacion,
        String fotoUrl,
        @NotEmpty Set<CategoriaServicio> categoriasServicio,
        Set<Certificacion> certificaciones) {
}
