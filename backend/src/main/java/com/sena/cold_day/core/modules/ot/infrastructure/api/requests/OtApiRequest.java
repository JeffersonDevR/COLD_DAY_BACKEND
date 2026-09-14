package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import java.util.List;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * OT creation payload (RF-F1-08): category, fault description, evidence and
 * geocoded address. The cliente is derived from the authenticated principal,
 * never from the body.
 */
public record OtApiRequest(
        @NotNull CategoriaServicio categoriaServicio,
        @NotBlank @Size(max = 1000) String descripcionFalla,
        List<String> evidenciaUrls,
        @NotBlank @Size(max = 500) String direccion,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitud,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitud) {

    public Point toPoint() {
        return new Point(latitud, longitud);
    }
}
