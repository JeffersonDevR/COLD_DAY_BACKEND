package com.sena.cold_day.core.modules.ot.domain.valueobjects;

/**
 * Actor that triggered an OT state change (design D2 actor attribution).
 * Cancellation stores this in {@code canceladaPor}.
 */
public enum ActorOt {
    CLIENTE, TECNICO, SISTEMA, ADMINISTRADOR
}
