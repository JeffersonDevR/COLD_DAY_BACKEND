package com.sena.cold_day.core.modules.administracion.domain.valueobjects;

import java.util.Objects;
import java.util.UUID;

/** Identificador del agregado {@code Liquidacion} (RF-F1-23/24). */
public record LiquidacionId(UUID valor) {

    public LiquidacionId {
        Objects.requireNonNull(valor, "El identificador no puede ser nulo");
    }

    public static LiquidacionId nueva() {
        return new LiquidacionId(UUID.randomUUID());
    }

    public static LiquidacionId desde(UUID valor) {
        return new LiquidacionId(valor);
    }

    /** Spring MVC path-variable binding factory: {@code @PathVariable LiquidacionId}. */
    public static LiquidacionId of(String valor) {
        return new LiquidacionId(UUID.fromString(valor));
    }

    @Override
    public String toString() {
        return valor.toString();
    }
}
