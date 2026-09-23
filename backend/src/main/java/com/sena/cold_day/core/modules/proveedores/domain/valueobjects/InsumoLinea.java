package com.sena.cold_day.core.modules.proveedores.domain.valueobjects;

/**
 * One free-text insumo line declared by the technician in a diagnóstico (spec
 * disp.R1). There is no managed catalog and no {@code Insumo} entity: the line
 * is a description plus a positive quantity (design AD5, non-requirements).
 */
public record InsumoLinea(String descripcion, int cantidad) {

    public InsumoLinea {
        if (descripcion == null || descripcion.isBlank()) {
            throw new IllegalArgumentException("La descripcion del insumo es requerida");
        }
        if (cantidad <= 0) {
            throw new IllegalArgumentException("La cantidad del insumo debe ser positiva");
        }
    }
}
