package com.sena.cold_day.core.modules.proveedores.domain.valueobjects;

import java.util.Objects;
import java.util.UUID;

/** Identifier of a supplier offer for an insumo request (own UUID primary key). */
public record OfertaInsumoId(UUID valor) {

    public OfertaInsumoId {
        Objects.requireNonNull(valor, "El identificador no puede ser nulo");
    }

    public static OfertaInsumoId nueva() {
        return new OfertaInsumoId(UUID.randomUUID());
    }

    public static OfertaInsumoId desde(UUID valor) {
        return new OfertaInsumoId(valor);
    }

    public static OfertaInsumoId desde(String valor) {
        return new OfertaInsumoId(UUID.fromString(valor));
    }

    /** Spring MVC path-variable binding factory: {@code @PathVariable OfertaInsumoId}. */
    public static OfertaInsumoId of(String valor) {
        return new OfertaInsumoId(UUID.fromString(valor));
    }

    @Override
    public String toString() {
        return valor.toString();
    }
}
