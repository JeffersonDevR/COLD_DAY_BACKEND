package com.sena.cold_day.core.modules.clientes.infrastructure.api.requests;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.domain.TextoPlano;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Alta pública de cliente: crea el Usuario (rol CLIENTE) y su perfil en una sola
 * transacción (mismo patrón que {@code /api/tecnicos}). Por eso incluye la
 * identidad y no un {@code usuarioId}.
 * {@code tipoCliente}, {@code calle}, {@code ciudad}, {@code barrio} y {@code ubicacion} son opcionales:
 * el registro es minimo y la direccion se captura al crear la OT.
 */
public record ClienteOnboardingApiRequest(
        @NotBlank String nombre,
        @NotBlank @Email String correo,
        @NotBlank @Size(min = 8, max = 72) String password,
        String telefono,
        String fotoUrl,
        TipoCliente tipoCliente,
        String calle,
        String ciudad,
        String barrio,
        Point ubicacion,
        @NotNull Boolean aceptaHabeasData) {

    public ClienteOnboardingApiRequest {
        // Free-text normalization only: password stays byte-for-byte intact.
        nombre = TextoPlano.limpiar(nombre);
        correo = TextoPlano.limpiar(correo);
        telefono = TextoPlano.limpiar(telefono);
        calle = TextoPlano.limpiar(calle);
        ciudad = TextoPlano.limpiar(ciudad);
        barrio = TextoPlano.limpiar(barrio);
    }
}
