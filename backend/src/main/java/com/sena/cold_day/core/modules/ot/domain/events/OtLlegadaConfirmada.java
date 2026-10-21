package com.sena.cold_day.core.modules.ot.domain.events;

import java.time.Instant;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * The assigned technician confirmed the arrival on site (RF-F1-14).
 *
 * <p>Arrival is a fact, not a transition: SRS 5.2 has no {@code EN_LLEGADO}
 * state, so the order keeps whatever state it had (always {@code EN_CAMINO})
 * and no history entry is appended. That is why this event carries no
 * origin/destination pair: {@code estado} is the state the order was in when
 * the arrival was reported and {@code llegadaEn} is the instant the
 * technician reported.
 *
 * <p>It exists so the order stream can wake a subscriber up when something
 * happened on the order even though its state did not change.
 */
public record OtLlegadaConfirmada(OtId otId, EstadoOt estado, Instant llegadaEn) {
}
