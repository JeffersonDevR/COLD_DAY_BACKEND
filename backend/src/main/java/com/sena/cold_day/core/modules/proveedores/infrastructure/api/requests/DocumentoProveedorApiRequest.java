package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import java.time.LocalDate;

import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.NotBlank;

public record DocumentoProveedorApiRequest(@NotBlank String tipo, LocalDate fechaVencimiento) {

    public DocumentoProveedorApiRequest {
        tipo = TextoPlano.limpiar(tipo);
    }
}
