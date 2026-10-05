package com.sena.cold_day.core.modules.proveedores.application.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Application command for supplier registration. It carries the supplier's
 * account credentials alongside its business identity, mirroring the technician
 * registration contract. The role is NOT part of this command: it is applied at
 * creation ({@code Rol.PROVEEDOR}) inside {@code RegistrarProveedorUseCase},
 * and the supplier supplies their own initial password.
 */
public record ProveedorRequest(
        @NotBlank String nombre,
        @NotBlank @Email String correo,
        @NotBlank String password,
        String telefono,
        @NotBlank String razonSocial,
        @NotBlank String nit,
        boolean aceptaHabeasData) {
}
