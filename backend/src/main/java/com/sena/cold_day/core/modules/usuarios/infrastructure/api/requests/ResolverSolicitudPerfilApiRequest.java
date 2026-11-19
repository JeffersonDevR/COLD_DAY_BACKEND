package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body de {@code PATCH /api/admin/solicitudes-perfil/{id}/resolver}. */
public record ResolverSolicitudPerfilApiRequest(
        @NotNull Boolean aprobar,
        @Size(max = 500) String motivoRechazo) {

    public ResolverSolicitudPerfilApiRequest {
        motivoRechazo = TextoPlano.limpiar(motivoRechazo);
    }
}
