package com.sena.cold_day.modules.tecnicos.infrastructure.api.requests;

import java.util.Set;

import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record TecnicoApiRequest(
        @NotBlank String numeroIdentificacion,
        @NotBlank String nombres,
        @NotBlank String apellidos,
        String telefono,
        @Email String email,
        String fotoUrl,
        Set<CategoriaServicio> categoriasServicio,
        Set<Certificacion> certificaciones) {
}
