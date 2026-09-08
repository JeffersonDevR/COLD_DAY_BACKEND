package com.sena.cold_day.modules.tecnicos.application.dto;

import java.util.Set;

import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;

public record TecnicoResponse(
        Long id,
        String numeroIdentificacion,
        String nombres,
        String apellidos,
        String telefono,
        String email,
        String fotoUrl,
        Set<CategoriaServicio> categoriasServicio,
        EstadoOperativo estadoOperativo,
        Set<Certificacion> certificaciones,
        boolean activo) {
}
