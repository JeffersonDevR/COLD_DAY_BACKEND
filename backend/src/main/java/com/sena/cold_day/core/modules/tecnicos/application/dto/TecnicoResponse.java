package com.sena.cold_day.core.modules.tecnicos.application.dto;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Flat view exposed to the HTTP client; it combines Usuario (identity) and
 * Tecnico (profile) even though internally they are two aggregates.
 */
public record TecnicoResponse(
        TecnicoId id,
        Long usuarioId,
        String nombre,
        String correo,
        String telefono,
        String numeroIdentificacion,
        String fotoUrl,
        Set<CategoriaServicio> categoriasServicio,
        EstadoOperativo estadoOperativo,
        EstadoValidacion estadoValidacion,
        String motivoRechazoValidacion,
        Set<Certificacion> certificaciones,
        boolean activo) {
}
