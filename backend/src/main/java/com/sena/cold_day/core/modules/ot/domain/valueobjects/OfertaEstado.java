package com.sena.cold_day.core.modules.ot.domain.valueobjects;

/**
 * Lifecycle of a dispatch offer (design D4/D5). {@code PENDIENTE} is the only
 * state in which an offer is actionable; the winner becomes {@code ACEPTADA},
 * a closed window becomes {@code EXPIRADA} and sibling offers invalidated by an
 * acceptance become {@code CANCELADA}.
 */
public enum OfertaEstado {
    PENDIENTE,
    ACEPTADA,
    EXPIRADA,
    CANCELADA
}
