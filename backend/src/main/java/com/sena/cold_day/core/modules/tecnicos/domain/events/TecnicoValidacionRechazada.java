package com.sena.cold_day.core.modules.tecnicos.domain.events;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/** Published when the administrator rejects the tecnico documentation (CU-03, 2a). */
public record TecnicoValidacionRechazada(TecnicoId tecnicoId, String motivo) {
}
