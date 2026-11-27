package com.sena.cold_day.core.modules.proveedores.domain.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
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
     * Open requests with a radius whose current window closed while the request
     * itself is still alive: the candidates of the escalation sweep. Legacy rows
     * without a radius are never returned.
     */
    List<RequerimientoInsumo> buscarEscalables(Instant ahora);

    /**
     * Atomic widening of the radius: only while the request is still
     * {@code SOLICITADO}. Returns 0 when a supplier accepted in the meantime, so the
     * sweep never overwrites an acceptance with the stale copy it loaded (a full
     * {@code save} would, because the accept gate does not bump the row version).
     */
    int escalarSiAbierto(RequerimientoInsumoId id, double radioKm, Instant ventanaExpiraEn);

    /**
     * Atomically claims the ETA warning of an accepted, not yet dispatched request.
     * Returns 1 only for the caller that recorded it, so the warning is sent once
     * even if the supplier dispatches or another sweep runs at the same time.
     */
    int marcarEtaAvisado(RequerimientoInsumoId id, Instant ahora);

    /**
     * Accepted requests (still {@code ASIGNADO}) whose committed ETA has elapsed
     * without a dispatch and that were not warned yet.
     */
    List<RequerimientoInsumo> buscarEtaVencidos(Instant ahora);

    /**
     * Conditional bulk UPDATE: exactly one concurrent accept can flip the
     * request from {@code SOLICITADO} to {@code ASIGNADO}, and only while its
     * server-authoritative window is still open. The winner also records the ETA it
     * committed to, the distance of its offer and the acceptance time in the same
     * statement. Returns 1 for the winner.
     */
    int intentarAsignar(RequerimientoInsumoId id, Instant ahora, int etaMinutos, Double distanciaKm);

    /**
     * Closes every still-open request whose window passed with no acceptance
     * ({@code SOLICITADO -> SIN_PROVEEDOR}). The request is terminal-but-retriable
     * and the OT lifecycle is never blocked (spec disp.R6, design D4).
     */
    int expirarVencidos(Instant ahora);

    /**
     * Atomically reopens an accepted request whose committed ETA elapsed without a
     * dispatch: back to {@code SOLICITADO} with a fresh window and without the
     * previous acceptance data. Returns 0 if it is not the technician's, is not
     * {@code ASIGNADO} or the ETA has not elapsed yet.
     */
    int reabrirSiEtaVencido(RequerimientoInsumoId id, UUID tecnicoId, Instant ahora, Instant expiraEn,
            double radioKm, Instant ventanaExpiraEn);

    /**
     * Atomic dispatch: only while the request is {@code ASIGNADO} and this supplier
     * still holds the {@code ACEPTADA} offer. Returns 0 otherwise.
     */
    int despacharSiAsignado(RequerimientoInsumoId id, ProveedorId proveedorId, Instant ahora);
}
