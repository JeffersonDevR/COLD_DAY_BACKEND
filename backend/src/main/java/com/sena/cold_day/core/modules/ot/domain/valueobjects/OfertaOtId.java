package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.util.Objects;
import java.util.UUID;

/** Identifier of a dispatch offer (own UUID primary key, design D4). */
public record OfertaOtId(UUID valor) {

    public OfertaOtId {
        Objects.requireNonNull(valor, "El identificador no puede ser nulo");
    }

    public static OfertaOtId nueva() {
        return new OfertaOtId(UUID.randomUUID());
    }

    public static OfertaOtId desde(UUID valor) {
        return new OfertaOtId(valor);
    }

    public static OfertaOtId desde(String valor) {
        return new OfertaOtId(UUID.fromString(valor));
    }

    /** Spring MVC path-variable binding factory: {@code @PathVariable OfertaOtId}. */
    public static OfertaOtId of(String valor) {
        return new OfertaOtId(UUID.fromString(valor));
    }

    @Override
    public String toString() {
        return valor.toString();
    }
}
