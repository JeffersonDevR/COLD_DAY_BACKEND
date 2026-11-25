package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** Donde opera el proveedor; de ahi sale el radio de difusion de los insumos. */
public record UbicacionProveedorApiRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitud,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitud) {
}
