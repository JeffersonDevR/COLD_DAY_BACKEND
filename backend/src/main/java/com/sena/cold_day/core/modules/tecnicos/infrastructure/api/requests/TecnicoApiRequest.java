package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record TecnicoApiRequest(
        @NotBlank String nombre,
        @NotBlank @Email String correo,
        @NotBlank String password,
        String telefono,
        @NotBlank String numeroIdentificacion,
        String fotoUrl,
        @NotEmpty Set<CategoriaServicio> categoriasServicio,
        Set<Certificacion> certificaciones,
        @NotNull Boolean aceptaHabeasData) {

    public TecnicoApiRequest {
        // Free-text normalization only: password stays byte-for-byte intact.
        nombre = TextoPlano.limpiar(nombre);
        correo = TextoPlano.limpiar(correo);
        telefono = TextoPlano.limpiar(telefono);
        numeroIdentificacion = TextoPlano.limpiar(numeroIdentificacion);
    }
}
