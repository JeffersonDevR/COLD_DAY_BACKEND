package com.sena.cold_day.core.modules.proveedores.domain.entities;

import java.time.LocalDate;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

public record DocumentoProveedor(Long id, ProveedorId proveedorId, String tipo, LocalDate fechaVencimiento) {

    public DocumentoProveedor {
        if (tipo == null || tipo.isBlank()) {
            throw new IllegalArgumentException("El tipo de documento es requerido");
        }
    }

    public boolean estaVigente(LocalDate hoy) {
        return fechaVencimiento == null || !fechaVencimiento.isBefore(hoy);
    }
}
