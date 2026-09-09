package com.sena.cold_day.core.modules.tecnicos.application.dto;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record TecnicoRequest(
        @NotBlank String numeroIdentificacion,
        @NotBlank String nombres,
        @NotBlank String apellidos,
        String telefono,
        @Email String email,
        String fotoUrl,
        Set<CategoriaServicio> categoriasServicio,
        Set<Certificacion> certificaciones) {
}
