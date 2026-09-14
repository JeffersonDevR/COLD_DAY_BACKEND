package com.sena.cold_day.core.modules.ot.application.dto;

import java.util.List;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;

/** Application-level input for OT creation (RF-F1-08). */
public record OtRequest(
        CategoriaServicio categoriaServicio,
        String descripcionFalla,
        List<String> evidenciaUrls,
        String direccion,
        Point ubicacion) {
}
