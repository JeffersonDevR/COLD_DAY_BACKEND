package com.sena.cold_day.modules.tecnicos.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;

interface SpringDataTecnicoRepository extends JpaRepository<TecnicoJpaEntity, Long> {
    List<TecnicoJpaEntity> findByActivoTrue();
    Optional<TecnicoJpaEntity> findByIdAndActivoTrue(Long id);
}
