package com.sena.cold_day.core.modules.ot.domain.valueobjects;

/**
 * Prioridad de una orden de trabajo (feature coherencia-ordenes-perfiles).
 *
 * <p>{@code MEDIA} es el valor de nacimiento: el cliente no elige la prioridad
 * al crear la orden, así que el servidor siempre la fija en MEDIA (V17).
 * {@code ALTA} y {@code BAJA} quedan disponibles para futuras reglas de negocio;
 * hoy se conservan al rehidratar una fila que ya las tiene.
 */
public enum Prioridad {
    ALTA,
    MEDIA,
    BAJA
}
