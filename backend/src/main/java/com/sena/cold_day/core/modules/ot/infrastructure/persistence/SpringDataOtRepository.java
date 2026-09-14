package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

public interface SpringDataOtRepository extends JpaRepository<OtJpaEntity, UUID> {

    List<OtJpaEntity> findByEstado(EstadoOt estado);

    List<OtJpaEntity> findByEstadoAndVentanaExpiraEnLessThanEqual(EstadoOt estado, Instant ahora);

    /**
     * Atomic cross-offer gate (design D5): exactly one concurrent accept can
     * flip the OT to {@code ASIGNADA}. Returns 1 for the winner, 0 otherwise.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OtJpaEntity o SET o.estado = :destino, o.tecnicoId = :tecnicoId, "
            + "o.asignadaEn = :ahora, o.radioKm = :radioKm "
            + "WHERE o.id = :id AND o.estado = :origen")
    int asignarSiDisponible(@Param("id") UUID id, @Param("tecnicoId") UUID tecnicoId,
            @Param("ahora") Instant ahora, @Param("radioKm") double radioKm,
            @Param("origen") EstadoOt origen, @Param("destino") EstadoOt destino);
}
