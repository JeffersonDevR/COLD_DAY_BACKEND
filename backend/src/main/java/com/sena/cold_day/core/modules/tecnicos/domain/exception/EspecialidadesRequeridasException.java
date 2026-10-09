package com.sena.cold_day.core.modules.tecnicos.domain.exception;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Thrown when a technician profile is left without any service category.
 * <p>
 * A technician with no specializations can never satisfy the radar filter
 * ({@code coincideCategoria}, RF-F1-04), so the profile would be silently
 * invisible to every client. Self-service edits must not be able to remove the
 * last specialization for that reason.
 */
public class EspecialidadesRequeridasException extends RuntimeException {

    public EspecialidadesRequeridasException(TecnicoId tecnicoId) {
        super("At least one service category is required for the technician %s".formatted(tecnicoId));
    }
}
