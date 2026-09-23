package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * One insumo line declared by the assigned technician in a diagnóstico (spec
 * disp.R1). It is a free-text description plus a positive quantity: there is no
 * managed catalog and no {@code Insumo} entity (design AD5). Bean Validation
 * keeps a blank description or a non-positive quantity a canonical 400, and the
 * lines are persisted in the despacho tables — never embedded in the OT
 * diagnóstico JSON column.
 */
public record InsumoLineaApiRequest(
        @NotBlank @Size(max = 500) String descripcion,
        @Min(1) int cantidad) {

    /** Maps the validated wire line to the despacho domain value object. */
    public InsumoLinea toDomain() {
        return new InsumoLinea(descripcion, cantidad);
    }
}
