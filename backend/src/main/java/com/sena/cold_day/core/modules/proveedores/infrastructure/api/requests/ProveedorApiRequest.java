package com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests;

import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorRequest;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Wire contract for supplier registration, public since self-registration was
 * opened: {@code correo}, {@code nombre}, {@code password}, {@code razonSocial}
 * and {@code nit} are required; a missing or invalid field is rejected with 400.
 * The supplier asserts Habeas Data consent itself ({@code aceptaHabeasData}) —
 * there is no administrator asserting it on their behalf any more.
 *
 * <p>There is deliberately NO {@code rol} component. The role is not input, it
 * is an output: {@code RegistrarProveedorUseCase} applies {@code Rol.PROVEEDOR}
 * at creation. Because the record does not declare the field, a client-supplied
 * {@code "rol"} is an unknown JSON property, Jackson drops it, and the account
 * is created with the only role this endpoint can ever grant. This is the same
 * closure {@code POST /api/usuarios} relies on, and it is what stops a public
 * registration endpoint from being a privilege-escalation vector.
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
