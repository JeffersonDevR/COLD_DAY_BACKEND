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

    /**
     * Highest per-year sequence already issued for {@code anio} among the
     * {@code OT-YYYY-####} codes, or {@code 0} when the year has none: the seed of
     * the next code (see
     * {@link com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt}).
     * Rows without a code are ignored. Callers read it inside the creation
     * transaction, before the order that will consume the number is saved.
     */
    // shortcut: the number is derived from the rows of the year, so two concurrent creations of the same year can compute the same one (the loser fails on idx_ot_codigo) and deleting the highest-numbered OT of a year frees its number, upgrade to a per-year counter row if concurrent creation or OT deletion becomes a real path.
    int ultimoNumeroCodigo(int anio);
}
