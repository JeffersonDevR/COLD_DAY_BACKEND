package com.sena.cold_day.core.modules.tecnicos.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;

@Repository
public class TecnicoRepositoryAdapter implements TecnicoRepository {

    private final SpringDataTecnicoRepository repository;

    public TecnicoRepositoryAdapter(SpringDataTecnicoRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public Tecnico save(Tecnico tecnico) {
        return repository.saveAndFlush(TecnicoJpaEntity.fromDomain(tecnico)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Tecnico> findByActivoTrue() {
        return repository.findByActivoTrue().stream().map(TecnicoJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Tecnico> findByIdAndActivoTrue(Long id) {
        return repository.findByIdAndActivoTrue(id).map(TecnicoJpaEntity::toDomain);
    }

    @Override
    @Transactional
    public void deleteAll() {
        repository.deleteAll();
    }
}
