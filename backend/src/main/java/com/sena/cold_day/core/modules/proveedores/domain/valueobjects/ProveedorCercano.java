package com.sena.cold_day.core.modules.proveedores.domain.valueobjects;

/** An eligible supplier inside the broadcast radius, with its straight-line distance to the delivery point. */
public record ProveedorCercano(ProveedorId proveedorId, double distanciaKm) {
}
