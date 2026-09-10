package com.sena.cold_day.core.modules.tecnicos.domain.events;

/**
 * Published when a technician is created. Carries the new id so other
 * modules can react after the create transaction commits.
 */
public record TecnicoCreado(com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId tecnicoId) {
}
