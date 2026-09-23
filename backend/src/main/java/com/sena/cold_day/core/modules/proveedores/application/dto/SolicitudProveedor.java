package com.sena.cold_day.core.modules.proveedores.application.dto;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;

/**
 * Read projection pairing a supplier's pending offer with the request it points
 * at (spec disp.R3, design flow (b)). The supplier portal needs both halves: the
 * offer id to accept or reject, and the request lines to know what is being
 * asked for. Keeping the pair in the application layer lets the REST controller
 * render the listing without ever querying a repository itself.
 */
public record SolicitudProveedor(OfertaInsumo oferta, RequerimientoInsumo requerimiento) {
}
