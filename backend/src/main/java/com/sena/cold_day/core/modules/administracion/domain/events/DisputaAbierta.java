package com.sena.cold_day.core.modules.administracion.domain.events;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;

/** El cliente abrio una disputa sobre la OT (RF-F1-25). */
public record DisputaAbierta(DisputaId disputaId) {
}
