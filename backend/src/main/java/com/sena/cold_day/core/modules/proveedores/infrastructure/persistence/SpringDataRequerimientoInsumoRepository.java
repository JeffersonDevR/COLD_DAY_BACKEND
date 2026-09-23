package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;

public interface SpringDataRequerimientoInsumoRepository
        extends JpaRepository<RequerimientoInsumoJpaEntity, UUID> {

    List<RequerimientoInsumoJpaEntity> findByOtId(UUID otId);

    List<RequerimientoInsumoJpaEntity> findByTecnicoId(UUID tecnicoId);

    List<RequerimientoInsumoJpaEntity> findByEstadoAndExpiraEnLessThanEqual(EstadoRequerimiento estado,
            Instant ahora);

    /**
     * Atomic first-accept root gate (design AD6): exactly one concurrent accept
     * can flip the request to {@code ASIGNADO}, and only while its window is open.
     * Returns 1 for the winner, 0 otherwise.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE RequerimientoInsumoJpaEntity r SET r.estado = :destino "
            + "WHERE r.id = :id AND r.estado = :origen AND r.expiraEn > :ahora")
    int asignarSiDisponible(@Param("id") UUID id, @Param("ahora") Instant ahora,
            @Param("origen") EstadoRequerimiento origen, @Param("destino") EstadoRequerimiento destino);

    /**
     * Bulk resolution of every open request whose window expired with no winner
     * ({@code SOLICITADO -> SIN_PROVEEDOR}). Returns how many rows were closed.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE RequerimientoInsumoJpaEntity r SET r.estado = :destino, r.resueltaEn = :ahora "
            + "WHERE r.estado = :origen AND r.expiraEn <= :ahora")
    int expirarVencidos(@Param("ahora") Instant ahora,
            @Param("origen") EstadoRequerimiento origen, @Param("destino") EstadoRequerimiento destino);
}
