package com.sena.cold_day.tecnicos.internal.domain;

import java.time.LocalDate;

import jakarta.persistence.Embeddable;

/**
 * Technician certification; expiry is recorded at write time
 * (expiry notifications are a later change).
 */
@Embeddable
public record Certificacion(String tipo, String entidad, LocalDate fechaVencimiento) {
}
