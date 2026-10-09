package com.sena.cold_day.core.modules.ot.domain.events;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * Generic state-change event, published for every accepted OT transition.
 *
 * <p>Unlike the specific events ({@code OtCreada}, {@code OtAsignada},
 * {@code OtFinalizada}, ...), this one also covers the transitions that have no
 * dedicated event today ({@code ASIGNADA -> EN_CAMINO},
 * {@code EN_CAMINO -> EN_DIAGNOSTICO}, {@code EN_DIAGNOSTICO -> EN_REPARACION}).
 * It is the single event the real-time stream listens to.
 *
 * <p>{@code origen} is {@code null} for the creation entry, which lands
 * directly in {@code SOLICITADA}.
 */
public record OtEstadoCambiado(OtId otId, EstadoOt origen, EstadoOt destino) {
}
