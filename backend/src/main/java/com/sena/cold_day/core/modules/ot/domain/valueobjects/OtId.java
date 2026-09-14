package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.util.Objects;
import java.util.UUID;

/** Identifier of the {@code Ot} aggregate (own UUID primary key). */
public record OtId(UUID valor) {

    public OtId {
        Objects.requireNonNull(valor, "El identificador no puede ser nulo");
    }

    public static OtId nueva() {
        return new OtId(UUID.randomUUID());
    }

    public static OtId desde(UUID valor) {
        return new OtId(valor);
    }

    public static OtId desde(String valor) {
        return new OtId(UUID.fromString(valor));
    }

    /** Spring MVC path-variable binding factory: {@code @PathVariable OtId}. */
    public static OtId of(String valor) {
        return new OtId(UUID.fromString(valor));
    }

    @Override
    public String toString() {
        return valor.toString();
    }
}
