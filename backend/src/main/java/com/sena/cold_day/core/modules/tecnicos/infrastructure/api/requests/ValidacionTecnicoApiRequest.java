package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import jakarta.validation.constraints.NotBlank;

/** Body of PATCH /api/tecnicos/{id}/validacion (CU-03, rol ADMINISTRADOR). */
public record ValidacionTecnicoApiRequest(
        @NotBlank String accion,
        String motivo) {

    public boolean esAprobar() {
        return "APROBAR".equalsIgnoreCase(accion);
    }
}
