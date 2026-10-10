package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;

/** Body of PATCH /api/proveedores/{id}/validacion (rol ADMINISTRADOR). */
public record ValidacionProveedorApiRequest(@NotBlank String accion, String motivo) {

    public ValidacionProveedorApiRequest {
        motivo = TextoPlano.limpiar(motivo);
    }

    public boolean esAprobar() {
        return "APROBAR".equalsIgnoreCase(accion);
    }
}
