package com.sena.cold_day.core.modules.administracion.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.domain.entities.Disputa;
import com.sena.cold_day.core.modules.administracion.domain.repository.DisputaRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.administracion.infrastructure.persistence.DisputaJpaEntity;
import com.sena.cold_day.core.modules.administracion.infrastructure.persistence.SpringDataDisputaRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

@Repository
public class DisputaRepositoryAdapter implements DisputaRepository {

    private final SpringDataDisputaRepository repository;

    public DisputaRepositoryAdapter(SpringDataDisputaRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public Disputa save(Disputa disputa) {
        DisputaJpaEntity entity = disputa.getId() == null
                ? DisputaJpaEntity.fromDomain(disputa)
                : repository.findById(disputa.getId().valor())
                        .map(existing -> {
                            existing.applyFromDomain(disputa);
                            return existing;
                        })
                        .orElseGet(() -> DisputaJpaEntity.fromDomain(disputa));
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Disputa> buscarPorId(DisputaId id) {
        return repository.findById(id.valor()).map(DisputaJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Disputa> buscarAbiertaPorOt(OtId otId) {
        return repository.findFirstByOtIdAndEstado(otId.valor(), EstadoDisputa.ABIERTA)
                .map(DisputaJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Disputa> buscarPorEstado(EstadoDisputa estado) {
        return repository.findByEstado(estado).stream()
                .map(DisputaJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Disputa> listarTodas() {
        return repository.findAll().stream().map(DisputaJpaEntity::toDomain).toList();
    }
}
