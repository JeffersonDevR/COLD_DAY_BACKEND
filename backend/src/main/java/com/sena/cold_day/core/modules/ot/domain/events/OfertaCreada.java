package com.sena.cold_day.core.modules.ot.domain.events;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Published once per persisted dispatch offer, so the technician who received it
 * can be told their offers changed without polling.
 *
 * <p>One event per technician, not one per dispatch round: the recipient is part
 * of the event, which is what lets the SSE bridge key the stream by technician
 * instead of by OT. The OT channel cannot express "a new offer for THIS
 * technician" — the offers page has no OT context to key on.
 */
public record OfertaCreada(OtId otId, TecnicoId tecnicoId) {
}
