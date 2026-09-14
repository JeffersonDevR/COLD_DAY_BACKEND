package com.sena.cold_day.core.modules.administracion.domain.events;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;

/** El administrador resolvio la disputa con o sin acuerdo (RF-F1-25). */
public record DisputaResuelta(DisputaId disputaId, boolean conAcuerdo) {
}
