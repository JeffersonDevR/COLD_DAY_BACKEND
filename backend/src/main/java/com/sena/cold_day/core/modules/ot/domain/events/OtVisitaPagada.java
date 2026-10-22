package com.sena.cold_day.core.modules.ot.domain.events;

import java.time.Instant;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * The client paid the visit fee (RF-F1-26).
 *
 * <p>Paying the visit of an {@code ASIGNADA} order is a fact and not a
 * transition: the order keeps its state, so no {@code CambioEstado} is
 * produced and the repository drain loop - the only publisher of the generic
 * state-change event - stays silent. Without this event the technician
 * watching the order would never learn that the client paid and that the
 * displacement can start.
 *
 * <p>It carries no origin/destination pair for the same reason the arrival
 * does: {@code estado} is the state the order was in when the payment was
 * registered and {@code visitaPagadaEn} is the instant the client paid.
 *
 * <p>It exists so the order stream can wake a subscriber up when something
 * happened on the order even though its state did not change.
 */
public record OtVisitaPagada(OtId otId, EstadoOt estado, Instant visitaPagadaEn) {
}
