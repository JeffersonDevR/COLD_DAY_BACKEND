package com.sena.cold_day.core.modules.administracion.domain.valueobjects;

import java.util.Objects;
import java.util.UUID;

/** Identificador de la {@code Disputa} de mediacion administrativa (RF-F1-25). */
public record DisputaId(UUID valor) {

    public DisputaId {
        Objects.requireNonNull(valor, "El identificador no puede ser nulo");
    }

    public static DisputaId nueva() {
        return new DisputaId(UUID.randomUUID());
    }

    public static DisputaId desde(UUID valor) {
        return new DisputaId(valor);
    }

    /** Spring MVC path-variable binding factory: {@code @PathVariable DisputaId}. */
    public static DisputaId of(String valor) {
        return new DisputaId(UUID.fromString(valor));
    }

    @Override
    public String toString() {
        return valor.toString();
    }
}
