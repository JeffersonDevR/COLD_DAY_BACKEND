package com.sena.cold_day.core.modules.proveedores.domain.valueobjects;

import java.util.Objects;
import java.util.UUID;

public record ProveedorId(UUID valor) {

    public ProveedorId {
        Objects.requireNonNull(valor, "El identificador no puede ser nulo");
    }

    public static ProveedorId nueva() {
        return new ProveedorId(UUID.randomUUID());
    }

    public static ProveedorId desde(UUID valor) {
        return new ProveedorId(valor);
    }

    public static ProveedorId desde(String valor) {
        return new ProveedorId(UUID.fromString(valor));
    }

    @Override
    public String toString() {
        return valor.toString();
    }
}
