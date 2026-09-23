package com.sena.cold_day.core.modules.proveedores.domain.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * Domain port for insumo-offer persistence (spec disp.R3/R4/R5, design AD6).
 * The conditional operations are the atomic primitives used by acceptance,
 * rejection, sibling invalidation and the expiry sweep.
 */
public interface OfertaInsumoRepository {

    OfertaInsumo save(OfertaInsumo oferta);

    Optional<OfertaInsumo> buscarPorId(OfertaInsumoId id);

    /** Pending offers broadcast for one request, oldest first. */
    List<OfertaInsumo> listarPendientesPorRequerimiento(RequerimientoInsumoId requerimientoId);

    /** Offers of a supplier, optionally filtered by states (empty = all). */
    List<OfertaInsumo> listarPorProveedor(ProveedorId proveedorId, OfertaInsumoEstado... estados);

    /** Conditional accept: pending and not expired. Returns 1 for the winner, 0 otherwise. */
    int intentarAceptar(OfertaInsumoId id, Instant ahora);

    /** Moves every pending offer of the request to {@code nuevo} (sibling invalidation). */
    void invalidarPendientesDe(RequerimientoInsumoId requerimientoId, OfertaInsumoEstado nuevo, Instant ahora);

    /** Closes every pending offer whose server-authoritative window expired. */
    int expirarVencidas(Instant ahora);
}
