package com.sena.cold_day.core.modules.tecnicos.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.NumeroIdentificacionDuplicadoException;
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
        try {
            TecnicoJpaEntity entity = tecnico.getId() == null
                    ? TecnicoJpaEntity.fromDomain(tecnico)
                    : repository.findById(tecnico.getId().valor())
                            .map(existing -> {
                                existing.applyFromDomain(tecnico);
                                return existing;
                            })
                            .orElseGet(() -> TecnicoJpaEntity.fromDomain(tecnico));
            return repository.saveAndFlush(entity).toDomain();
        } catch (DataIntegrityViolationException e) {
            throw new NumeroIdentificacionDuplicadoException(tecnico.getNumeroIdentificacion());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<Tecnico> findByActivoTrue() {
        return repository.findByActivoTrue().stream().map(TecnicoJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Tecnico> findByIdAndActivoTrue(TecnicoId id) {
        return repository.findByIdAndActivoTrue(id.valor()).map(TecnicoJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Tecnico> findByUsuarioIdAndActivoTrue(Long usuarioId) {
        return repository.findByUsuarioIdAndActivoTrue(usuarioId).map(TecnicoJpaEntity::toDomain);
    }

    @Override
    @Transactional
    public void deleteAll() {
        repository.deleteAll();
    }
}
