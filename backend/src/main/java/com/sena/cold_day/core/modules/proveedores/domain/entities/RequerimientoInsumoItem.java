package com.sena.cold_day.core.modules.proveedores.domain.entities;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;

/**
 * Immutable line item of a {@code RequerimientoInsumo} (spec disp.R1): the
 * free-text description and quantity declared at diagnóstico time. The entity
 * carries its own id only for persistence; it is never mutated once created.
 */
public class RequerimientoInsumoItem {

    private final Long id;
    private final String descripcion;
    private final int cantidad;

    private RequerimientoInsumoItem(Long id, String descripcion, int cantidad) {
        this.id = id;
        this.descripcion = descripcion;
        this.cantidad = cantidad;
    }

    /** New item from a declared line (id is assigned by persistence). */
    public static RequerimientoInsumoItem crear(InsumoLinea linea) {
        if (linea == null) {
            throw new IllegalArgumentException("La linea de insumo es requerida");
        }
        return new RequerimientoInsumoItem(null, linea.descripcion(), linea.cantidad());
    }

    /** Rehydrates a persisted item. */
    public static RequerimientoInsumoItem reconstituir(Long id, String descripcion, int cantidad) {
        return new RequerimientoInsumoItem(id, descripcion, cantidad);
    }

    public Long getId() {
        return id;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public int getCantidad() {
        return cantidad;
    }
}
