package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;

public interface SpringDataOfertaOtRepository extends JpaRepository<OfertaOtJpaEntity, UUID> {

    List<OfertaOtJpaEntity> findByOtIdAndEstadoOrderByCreadaEnAsc(UUID otId, OfertaEstado estado);

    List<OfertaOtJpaEntity> findByTecnicoId(UUID tecnicoId);

    List<OfertaOtJpaEntity> findByTecnicoIdAndEstadoIn(UUID tecnicoId, Collection<OfertaEstado> estados);

    /**
     * Atomic accept (design D5): only a pending offer whose window is still open
     * can win. Returns 1 for the winner, 0 for every loser.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OfertaOtJpaEntity o SET o.estado = :aceptada, o.resueltaEn = :ahora "
            + "WHERE o.id = :id AND o.estado = :pendiente AND o.expiraEn > :ahora")
    int aceptarSiVigente(@Param("id") UUID id, @Param("ahora") Instant ahora,
            @Param("pendiente") OfertaEstado pendiente, @Param("aceptada") OfertaEstado aceptada);

    /**
     * Bulk resolution of every pending offer of an order (expiry on escalation or
     * sibling invalidation on acceptance). Only {@code PENDIENTE} rows change.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OfertaOtJpaEntity o SET o.estado = :destino, o.resueltaEn = :ahora "
            + "WHERE o.otId = :otId AND o.estado = :pendiente")
    int resolverPendientesDe(@Param("otId") UUID otId, @Param("ahora") Instant ahora,
            @Param("pendiente") OfertaEstado pendiente, @Param("destino") OfertaEstado destino);
}
