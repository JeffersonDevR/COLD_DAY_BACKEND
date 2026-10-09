package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Reduced order view attached to a dispatch offer, so the technician's offers
 * page can render each card without calling {@code GET /api/ot/{id}} (which
 * would 403: holding a pending offer is not participation in the order).
 *
 * <p><strong>Why this is not the full {@code OtApiResponse}.</strong> The
 * holder of a pending offer is not yet a participant of the order, so this
 * projection must carry only what the offer decision needs. It deliberately
 * excludes fields that only make sense after assignment or that leak more than
 * the decision requires: {@code actaCodigoVerificacion} (a verification code),
 * {@code diagnostico}, {@code presupuesto}, {@code clienteId},
 * {@code tarifaVisita}, {@code calificacion*}, {@code medioPagoVisita} and
 * {@code actaFirmada}. The card needs exactly: id, state, category, fault
 * description, address and client name. Coordinates are included because the
 * street address is already here, so they leak nothing extra and a future map
 * can use them.
 *
 * <p><strong>Rule for future fields:</strong> any field added to this summary
 * must be justified against "the holder is not yet a participant". If it only
 * makes sense once the technician owns the order, it does not belong here.
 */
public record OfertaOtResumenApiResponse(
        String id,
        EstadoOt estado,
        CategoriaServicio categoriaServicio,
        String descripcionFalla,
        String direccion,
        String clienteNombre,
        Double latitud,
        Double longitud) {

    /** Maps the application view of an order to the reduced offer summary. */
    public static OfertaOtResumenApiResponse de(OtResponse ot, String clienteNombre) {
        if (ot == null) {
            return null;
        }
        Point ubicacion = ot.ubicacion();
        return new OfertaOtResumenApiResponse(
                ot.id() == null ? null : ot.id().valor().toString(),
                ot.estado(), ot.categoriaServicio(), ot.descripcionFalla(), ot.direccion(),
                clienteNombre,
                ubicacion == null ? null : ubicacion.latitud(),
                ubicacion == null ? null : ubicacion.longitud());
    }
}
