package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import jakarta.validation.constraints.Size;

/** Optional free-text reason for rejecting a presented budget (RF-F1-20). */
public record RechazoPresupuestoApiRequest(
        @Size(max = 500) String motivo) {
}
