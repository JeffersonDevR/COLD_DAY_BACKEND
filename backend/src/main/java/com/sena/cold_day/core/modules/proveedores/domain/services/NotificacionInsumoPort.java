package com.sena.cold_day.core.modules.proveedores.domain.services;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

/**
 * Delivery port for insumo dispatch notifications (design AD14). It is owned by
 * the {@code proveedores} context: the {@code ot}-owned
 * {@code NotificacionPushPort} is typed {@code TecnicoId}/{@code OfertaOt}/
 * {@code Ot}/{@code ClienteId}, so extending it would force {@code ot} to import
 * {@code proveedores} types and invert the bounded-context direction.
 *
 * <p>Transport is optional and best-effort: the persisted offer state is
 * authoritative, so an adapter MUST never throw and a delivery failure MUST NOT
 * change the authoritative state (design AD11). The logging adapter ships in
 * slice 10; this slice declares the port only.
 */
public interface NotificacionInsumoPort {

    /** Notifies an eligible supplier about a new pending offer. */
    void notificarSolicitud(ProveedorId proveedorId, OfertaInsumo oferta, RequerimientoInsumo requerimiento);
}
