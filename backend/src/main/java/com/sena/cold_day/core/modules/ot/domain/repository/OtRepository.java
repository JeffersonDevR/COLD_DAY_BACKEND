package com.sena.cold_day.core.modules.ot.domain.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Domain port for OT persistence (design D5). {@code intentarAsignar} is the
 * atomic cross-offer gate: it returns {@code 1} for the winner and {@code 0}
 * for every loser.
 */
public interface OtRepository {

    Ot save(Ot ot);

    Optional<Ot> buscarPorId(OtId id);

    /**
     * Batch lookup by id. Read paths that must enrich several offers with their
     * order use this instead of looping {@link #buscarPorId(OtId)}, so the
     * enrichment stays a single query. Unknown ids are simply absent from the
     * result; callers must tolerate missing entries.
     */
    List<Ot> buscarPorIds(Collection<OtId> ids);

    List<Ot> buscarPorEstado(EstadoOt estado);

    List<Ot> buscarPorCliente(ClienteId clienteId);

    List<Ot> buscarPorTecnico(TecnicoId tecnicoId);

    List<Ot> listarTodas();

    /**
     * Conditional UPDATE: exactly one assignment for the searching order. The
     * auxiliar count defaults to zero (design AD3 delegating overload); callers
     * that do not declare auxiliares keep this signature untouched.
     */
    int intentarAsignar(OtId id, TecnicoId tecnicoId, Instant ahora, double radioKm);

    /**
     * Canonical conditional UPDATE carrying the declared auxiliar count in the
     * same atomic assignment (design AD2/AD3).
     */
    int intentarAsignar(OtId id, TecnicoId tecnicoId, Instant ahora, double radioKm,
            int auxiliaresRequeridos);

    /** Orders still searching whose dispatch window has closed. */
    List<Ot> buscarVentanasVencidas(Instant ahora);
}
