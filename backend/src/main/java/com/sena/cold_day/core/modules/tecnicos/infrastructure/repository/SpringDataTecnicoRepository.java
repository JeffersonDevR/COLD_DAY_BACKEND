package com.sena.cold_day.core.modules.tecnicos.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

public interface SpringDataTecnicoRepository extends JpaRepository<TecnicoJpaEntity, TecnicoId> {
    List<TecnicoJpaEntity> findByActivoTrue();
    Optional<TecnicoJpaEntity> findByIdAndActivoTrue(TecnicoId id);
}
