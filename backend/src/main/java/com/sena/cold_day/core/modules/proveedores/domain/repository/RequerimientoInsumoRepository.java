package com.sena.cold_day.core.modules.proveedores.domain.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * Domain port for the insumo request root (spec disp.R1/R3/R5, design AD5/AD6).
 * {@code intentarAsignar} is the atomic first-accept gate: it returns {@code 1}
 * for the single winner and {@code 0} for every loser, mirroring the OT
 * {@code OtRepository.intentarAsignar} primitive.
 */
public interface RequerimientoInsumoRepository {

    RequerimientoInsumo save(RequerimientoInsumo requerimiento);

    Optional<RequerimientoInsumo> buscarPorId(RequerimientoInsumoId id);

    /** Requests raised for one OT (dispatch query, oldest first). */
    List<RequerimientoInsumo> buscarPorOt(UUID otId);

    /** Requests raised by one technician (supplier-portal query). */
    List<RequerimientoInsumo> buscarPorTecnico(UUID tecnicoId);

    /**
     * Conditional bulk UPDATE: exactly one concurrent accept can flip the
     * request from {@code SOLICITADO} to {@code ASIGNADO}, and only while its
     * server-authoritative window is still open. Returns 1 for the winner.
     */
    int intentarAsignar(RequerimientoInsumoId id, Instant ahora);

    /**
     * Closes every still-open request whose window passed with no acceptance
     * ({@code SOLICITADO -> SIN_PROVEEDOR}). The request is terminal-but-retriable
     * and the OT lifecycle is never blocked (spec disp.R6, design D4).
     */
    int expirarVencidos(Instant ahora);
}
