package com.sena.cold_day.core.modules.administracion.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;

public interface SpringDataDisputaRepository extends JpaRepository<DisputaJpaEntity, UUID> {

    Optional<DisputaJpaEntity> findFirstByOtIdAndEstado(UUID otId, EstadoDisputa estado);

    List<DisputaJpaEntity> findByEstado(EstadoDisputa estado);
}
