package com.sena.cold_day.core.modules.proveedores.application.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Application command for admin supplier provisioning. It carries the supplier's
 * account credentials alongside its business identity, mirroring the technician
 * registration contract. The role is applied at creation ({@code Rol.PROVEEDOR})
 * and the administrator supplies the initial password.
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
