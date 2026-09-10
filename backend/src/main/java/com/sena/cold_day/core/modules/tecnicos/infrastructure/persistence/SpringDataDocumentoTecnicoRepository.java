package com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.DocumentoTecnicoJpaEntity;

public interface SpringDataDocumentoTecnicoRepository extends JpaRepository<DocumentoTecnicoJpaEntity, Long> {

    List<DocumentoTecnicoJpaEntity> findByTecnicoId(UUID tecnicoId);
}
