package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

/** Body of PATCH /api/proveedores/{id}/validacion (rol ADMINISTRADOR). */
public record ValidacionProveedorApiRequest(String accion, String motivo) {

    public boolean esAprobar() {
        return "APROBAR".equalsIgnoreCase(accion);
    }
}
