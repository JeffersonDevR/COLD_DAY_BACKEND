package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataOtEstadoHistorialRepository extends JpaRepository<OtEstadoHistorialJpaEntity, Long> {

    List<OtEstadoHistorialJpaEntity> findByOtIdOrderByOcurridoEnAscIdAsc(UUID otId);
}
