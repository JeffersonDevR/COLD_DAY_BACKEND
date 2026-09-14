package com.sena.cold_day.core.modules.ot.domain.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Domain port for dispatch-offer persistence (design D4/D5). The conditional
 * operations are the atomic primitives used by escalation and acceptance;
 * {@code intentarAceptar} returns {@code 1} only for the winning technician.
 */
public interface OfertaOtRepository {

    OfertaOt save(OfertaOt oferta);

    Optional<OfertaOt> buscarPorId(OfertaOtId id);

    /** Pending offers broadcast for one order, oldest first. */
    List<OfertaOt> listarPendientesPorOt(OtId otId);

    /** Offers of a technician, optionally filtered by states (empty = all). */
    List<OfertaOt> listarPorTecnico(TecnicoId tecnicoId, OfertaEstado... estados);

    /** Conditional accept: pending and not expired. Returns 1 for the winner, 0 otherwise. */
    int intentarAceptar(OfertaOtId id, Instant ahora);

    /** Moves every pending offer of the order to {@code nuevo} (sibling invalidation). */
    void invalidarPendientesDe(OtId otId, OfertaEstado nuevo, Instant ahora);

    /** Closes every pending offer of the order whose window expired. */
    void expirarDe(OtId otId, Instant ahora);
}
