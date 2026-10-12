package com.sena.cold_day.core.modules.ot.infrastructure.api.requests;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Size;

/**
 * Cancellation payload (RF-F1-21). The reason is mandatory but validated in the
 * use case so the state-machine guard surfaces a conflict (409) before the
 * missing-reason rejection (400).
 *
 * <p>{@code actorRol} is optional: a dual-role user that is BOTH the owning
 * client and the assigned technician of the same OT MUST send it, since the
 * actor cannot be inferred from the resource (design D5 / M4). Every other
 * caller leaves it {@code null} and the use case infers the actor.
 */
public record CancelarOtApiRequest(
        @Size(max = 500) String motivo,
        ActorOt actorRol) {

    public CancelarOtApiRequest {
        motivo = TextoPlano.limpiar(motivo);
    }
}
