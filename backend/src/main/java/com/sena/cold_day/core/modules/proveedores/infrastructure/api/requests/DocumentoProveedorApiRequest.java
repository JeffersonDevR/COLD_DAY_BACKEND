package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;

public record DocumentoProveedorApiRequest(@NotBlank String tipo, LocalDate fechaVencimiento) {
}
