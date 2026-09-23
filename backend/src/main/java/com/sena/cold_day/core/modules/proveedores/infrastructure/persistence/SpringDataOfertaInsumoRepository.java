package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;

public interface SpringDataOfertaInsumoRepository extends JpaRepository<OfertaInsumoJpaEntity, UUID> {

    List<OfertaInsumoJpaEntity> findByRequerimientoIdAndEstadoOrderByCreadaEnAsc(UUID requerimientoId,
            OfertaInsumoEstado estado);

    List<OfertaInsumoJpaEntity> findByProveedorId(UUID proveedorId);

    List<OfertaInsumoJpaEntity> findByProveedorIdAndEstadoIn(UUID proveedorId,
            Collection<OfertaInsumoEstado> estados);

    /**
     * Atomic accept (design AD6): only a pending offer whose window is still open
     * can win. Returns 1 for the winner, 0 for every loser (concurrent or late).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OfertaInsumoJpaEntity o SET o.estado = :aceptada, o.resueltaEn = :ahora "
            + "WHERE o.id = :id AND o.estado = :pendiente AND o.expiraEn > :ahora")
    int aceptarSiVigente(@Param("id") UUID id, @Param("ahora") Instant ahora,
            @Param("pendiente") OfertaInsumoEstado pendiente, @Param("aceptada") OfertaInsumoEstado aceptada);

    /**
     * Bulk resolution of every pending offer of a request (sibling invalidation on
     * acceptance or rejection). Only {@code PENDIENTE} rows change.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OfertaInsumoJpaEntity o SET o.estado = :destino, o.resueltaEn = :ahora "
            + "WHERE o.requerimientoId = :requerimientoId AND o.estado = :pendiente")
    int resolverPendientesDe(@Param("requerimientoId") UUID requerimientoId, @Param("ahora") Instant ahora,
            @Param("pendiente") OfertaInsumoEstado pendiente, @Param("destino") OfertaInsumoEstado destino);

    /**
     * Sweep: closes every pending offer whose server-authoritative window expired
     * (spec disp.R4). Returns how many offers were closed.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OfertaInsumoJpaEntity o SET o.estado = :expirada, o.resueltaEn = :ahora "
            + "WHERE o.estado = :pendiente AND o.expiraEn <= :ahora")
    int expirarVencidas(@Param("ahora") Instant ahora,
            @Param("pendiente") OfertaInsumoEstado pendiente, @Param("expirada") OfertaInsumoEstado expirada);
}
