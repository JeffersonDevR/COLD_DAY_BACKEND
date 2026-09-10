package com.sena.cold_day.core.modules.tecnicos.domain.exception;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Thrown when not every required document of the tecnico is vigente, so the
 * administrator cannot approve (CU-03 step 3 rule).
 */
public class DocumentacionIncompletaException extends RuntimeException {

    public DocumentacionIncompletaException(TecnicoId tecnicoId) {
        super("Documentacion incompleta o vencida del técnico %d".formatted(tecnicoId));
    }
}
