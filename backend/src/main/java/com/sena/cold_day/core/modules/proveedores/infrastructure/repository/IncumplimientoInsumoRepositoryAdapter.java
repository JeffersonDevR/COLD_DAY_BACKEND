package com.sena.cold_day.core.modules.proveedores.infrastructure.repository;

import java.util.List;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.entities.IncumplimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.IncumplimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.IncumplimientoInsumoJpaEntity;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataIncumplimientoInsumoRepository;

/** Adapter for the ETA breach record. */
@Repository
public class IncumplimientoInsumoRepositoryAdapter implements IncumplimientoInsumoRepository {

    private final SpringDataIncumplimientoInsumoRepository repository;

    public IncumplimientoInsumoRepositoryAdapter(SpringDataIncumplimientoInsumoRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void guardar(IncumplimientoInsumo incumplimiento) {
        repository.saveAndFlush(IncumplimientoInsumoJpaEntity.fromDomain(incumplimiento));
    }

    @Override
    @Transactional(readOnly = true)
    public List<IncumplimientoInsumo> recientes() {
        return repository.findTop200ByOrderByReemplazadoEnDesc().stream()
                .map(IncumplimientoInsumoJpaEntity::toDomain).toList();
    }
}
