package com.sena.cold_day.core.modules.tecnicos.infrastructure.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;

public interface SpringDataTecnicoRepository extends JpaRepository<TecnicoJpaEntity, UUID> {
    List<TecnicoJpaEntity> findByActivoTrue();
    Optional<TecnicoJpaEntity> findByIdAndActivoTrue(UUID id);
}
