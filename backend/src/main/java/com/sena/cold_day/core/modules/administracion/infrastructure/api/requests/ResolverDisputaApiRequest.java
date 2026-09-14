package com.sena.cold_day.core.modules.administracion.infrastructure.api.requests;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Resolucion de la disputa por el administrador (RF-F1-25): con acuerdo la OT
 * se finaliza; sin acuerdo se cancela sin cobro.
 */
public record ResolverDisputaApiRequest(
        @NotNull Boolean conAcuerdo,
        @NotBlank @Size(max = 1000) String resolucion) {
}
