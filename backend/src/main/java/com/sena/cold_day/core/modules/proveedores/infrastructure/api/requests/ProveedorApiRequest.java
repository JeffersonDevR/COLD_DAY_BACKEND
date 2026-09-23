package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorRequest;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Wire contract for admin supplier provisioning. {@code correo}, {@code nombre},
 * {@code password}, {@code razonSocial} and {@code nit} are required; a missing
 * or invalid field is rejected with 400. The administrator asserts Habeas Data
 * consent on the supplier's behalf ({@code aceptaHabeasData}).
 */
public record ProveedorApiRequest(
        @NotBlank String nombre,
        @NotBlank @Email String correo,
        @NotBlank String password,
        String telefono,
        @NotBlank String razonSocial,
        @NotBlank String nit,
        @NotNull Boolean aceptaHabeasData) {

    public ProveedorRequest toApplicationRequest() {
        return new ProveedorRequest(nombre, correo, password, telefono, razonSocial, nit,
                Boolean.TRUE.equals(aceptaHabeasData));
    }
}
