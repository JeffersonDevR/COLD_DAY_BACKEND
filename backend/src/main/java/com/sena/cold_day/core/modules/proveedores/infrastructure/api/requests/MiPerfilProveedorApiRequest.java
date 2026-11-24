package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Datos comerciales que el proveedor completa despues del registro. */
public record MiPerfilProveedorApiRequest(
        @NotBlank @Size(max = 255) String razonSocial,
        @NotBlank @Size(max = 50) String nit) {

    public MiPerfilProveedorApiRequest {
        razonSocial = TextoPlano.limpiar(razonSocial);
        nit = TextoPlano.limpiar(nit);
    }
}
