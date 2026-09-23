package com.sena.cold_day.core.modules.ot.domain.valueobjects;

/**
 * Source of the distance used to compute a visit tariff (design AD10).
 * <ul>
 * <li>{@code ROAD} — authoritative road distance from the maps provider.</li>
 * <li>{@code LINEAL} — Haversine fallback when maps is disabled or fails.</li>
 * </ul>
 */
public enum TarifaFuente {
    ROAD,
    LINEAL
}
