package com.sena.cold_day.core.modules.proveedores.domain.valueobjects;

import java.util.Objects;
import java.util.UUID;

/** Identifier of an insumo request (own UUID primary key, design AD5). */
public record RequerimientoInsumoId(UUID valor) {

    public RequerimientoInsumoId {
        Objects.requireNonNull(valor, "El identificador no puede ser nulo");
    }

    public static RequerimientoInsumoId nueva() {
        return new RequerimientoInsumoId(UUID.randomUUID());
    }

    public static RequerimientoInsumoId desde(UUID valor) {
        return new RequerimientoInsumoId(valor);
    }

    public static RequerimientoInsumoId desde(String valor) {
        return new RequerimientoInsumoId(UUID.fromString(valor));
    }

    /** Spring MVC path-variable binding factory: {@code @PathVariable RequerimientoInsumoId}. */
    public static RequerimientoInsumoId of(String valor) {
        return new RequerimientoInsumoId(UUID.fromString(valor));
    }

    @Override
    public String toString() {
        return valor.toString();
    }
}
