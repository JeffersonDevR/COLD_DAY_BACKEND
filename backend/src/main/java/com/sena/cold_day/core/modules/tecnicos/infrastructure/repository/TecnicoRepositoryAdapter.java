package com.sena.cold_day.core.modules.tecnicos.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.NumeroIdentificacionDuplicadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;

@Repository
public class TecnicoRepositoryAdapter implements TecnicoRepository {

    private final SpringDataTecnicoRepository repository;
    private final SpringDataUsuarioRepository usuarioRepository;

    public TecnicoRepositoryAdapter(SpringDataTecnicoRepository repository,
            SpringDataUsuarioRepository usuarioRepository) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional
    public Tecnico save(Tecnico tecnico) {
        UsuarioJpaEntity usuarioRef = usuarioRepository.getReferenceById(tecnico.getUsuarioId());
        try {
            TecnicoJpaEntity entity = tecnico.getId() == null
                    ? TecnicoJpaEntity.fromDomain(tecnico, usuarioRef)
                    : repository.findById(tecnico.getId())
                            .map(existing -> {
                                existing.applyFromDomain(tecnico);
                                return existing;
                            })
                            .orElseGet(() -> TecnicoJpaEntity.fromDomain(tecnico, usuarioRef));
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
    public Optional<Tecnico> findByIdAndActivoTrue(Long id) {
        return repository.findByIdAndActivoTrue(id).map(TecnicoJpaEntity::toDomain);
    }

    @Override
    @Transactional
    public void deleteAll() {
        repository.deleteAll();
    }
}
