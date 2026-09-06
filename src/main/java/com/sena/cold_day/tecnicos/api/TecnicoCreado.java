package com.sena.cold_day.tecnicos.api;

/**
 * Published when a technician is created. Carries the new id so other
 * modules can react after the create transaction commits.
 */
public record TecnicoCreado(Long tecnicoId) {
}
