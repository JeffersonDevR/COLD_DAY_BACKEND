package com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.DocumentoTecnicoJpaEntity;

public interface SpringDataDocumentoTecnicoRepository extends JpaRepository<DocumentoTecnicoJpaEntity, Long> {

    List<DocumentoTecnicoJpaEntity> findByTecnicoId(Long tecnicoId);
}
