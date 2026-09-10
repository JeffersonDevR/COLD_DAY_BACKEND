package com.sena.cold_day.core.modules.tecnicos.domain.events;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/** Published when the administrator approves the tecnico documentation (CU-03). */
public record TecnicoValidado(TecnicoId tecnicoId) {
}
