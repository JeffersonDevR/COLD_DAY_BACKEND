package com.sena.cold_day.core.modules.tecnicos.domain.events;

/** Published when the administrator rejects the tecnico documentation (CU-03, 2a). */
public record TecnicoValidacionRechazada(Long tecnicoId, String motivo) {
}
