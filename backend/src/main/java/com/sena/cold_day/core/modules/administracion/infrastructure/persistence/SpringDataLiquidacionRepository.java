package com.sena.cold_day.core.modules.administracion.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;

public interface SpringDataLiquidacionRepository extends JpaRepository<LiquidacionJpaEntity, UUID> {

    Optional<LiquidacionJpaEntity> findByOtId(UUID otId);

    List<LiquidacionJpaEntity> findByTecnicoId(UUID tecnicoId);

    List<LiquidacionJpaEntity> findByEstado(EstadoLiquidacion estado);

    boolean existsByTecnicoIdAndEstadoIn(UUID tecnicoId, List<EstadoLiquidacion> estados);
}
