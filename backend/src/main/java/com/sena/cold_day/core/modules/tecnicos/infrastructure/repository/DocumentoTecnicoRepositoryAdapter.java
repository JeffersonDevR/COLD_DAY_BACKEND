package com.sena.cold_day.core.modules.tecnicos.infrastructure.repository;

import java.util.List;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.DocumentoTecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.DocumentoTecnicoJpaEntity;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.SpringDataDocumentoTecnicoRepository;

@Repository
public class DocumentoTecnicoRepositoryAdapter implements DocumentoTecnicoRepository {

    private final SpringDataDocumentoTecnicoRepository repository;

    public DocumentoTecnicoRepositoryAdapter(SpringDataDocumentoTecnicoRepository repository) {
        this.repository = repository;
    }


    @Transactional(readOnly = true)
    @Override
    public List<DocumentoTecnico> buscarPorTecnico(TecnicoId tecnicoId) {
        return repository.findByTecnicoId(tecnicoId.valor()).stream().map(DocumentoTecnicoJpaEntity::toDomain).toList();
    }



    @Override
    @Transactional
    public DocumentoTecnico save(DocumentoTecnico documento) {
        return repository.save(DocumentoTecnicoJpaEntity.fromDomain(documento)).toDomain();
    }
}
