package com.sena.cold_day.core.modules.ot.application.dto;

import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;

/**
 * A technician's live offer paired with the application view of its order and
 * the client's display name.
 *
 * <p>{@code ot} is {@code null} when the referenced order cannot be resolved.
 * That is a defensive degradation: the offer itself is still a real row the
 * technician was notified about, so it travels without its order instead of
 * failing the whole list. The wire layer maps a null order to a null nested
 * summary and the client renders only offers that carry one.
 */
public record OfertaTecnicoResumen(OfertaOt oferta, OtResponse ot, String clienteNombre) {
}
