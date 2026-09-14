package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import jakarta.validation.constraints.Size;

/**
 * Cancellation payload (RF-F1-21). The reason is mandatory but validated in the
 * use case so the state-machine guard surfaces a conflict (409) before the
 * missing-reason rejection (400).
 */
public record CancelarOtApiRequest(
        @Size(max = 500) String motivo) {
}
