package com.sena.cold_day.core.modules.administracion.domain.valueobjects;

/**
 * Estado de la mediacion administrativa (RF-F1-25): la disputa nace
 * {@code ABIERTA} y el administrador la cierra con o sin acuerdo.
 */
public enum EstadoDisputa {
    ABIERTA,
    RESUELTA_CON_ACUERDO,
    RESUELTA_SIN_ACUERDO;

    public boolean esAbierta() {
        return this == ABIERTA;
    }
}
