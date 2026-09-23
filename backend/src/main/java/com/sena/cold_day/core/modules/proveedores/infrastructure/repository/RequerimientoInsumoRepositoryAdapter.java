package com.sena.cold_day.core.modules.proveedores.infrastructure.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.RequerimientoInsumoJpaEntity;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataRequerimientoInsumoRepository;

/** Adapter for the insumo-request port (design AD5/AD6). */
@Repository
public class RequerimientoInsumoRepositoryAdapter implements RequerimientoInsumoRepository {

    private final SpringDataRequerimientoInsumoRepository repository;

    public RequerimientoInsumoRepositoryAdapter(SpringDataRequerimientoInsumoRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public RequerimientoInsumo save(RequerimientoInsumo requerimiento) {
        RequerimientoInsumoJpaEntity entity = requerimiento.getId() == null
                ? RequerimientoInsumoJpaEntity.fromDomain(requerimiento)
                : repository.findById(requerimiento.getId().valor())
                        .map(existing -> {
                            existing.applyFromDomain(requerimiento);
                            return existing;
                        })
                        .orElseGet(() -> RequerimientoInsumoJpaEntity.fromDomain(requerimiento));
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<RequerimientoInsumo> buscarPorId(RequerimientoInsumoId id) {
        return repository.findById(id.valor()).map(RequerimientoInsumoJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RequerimientoInsumo> buscarPorOt(UUID otId) {
        return repository.findByOtId(otId).stream().map(RequerimientoInsumoJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RequerimientoInsumo> buscarPorTecnico(UUID tecnicoId) {
        return repository.findByTecnicoId(tecnicoId).stream()
                .map(RequerimientoInsumoJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional
    public int intentarAsignar(RequerimientoInsumoId id, Instant ahora) {
        return repository.asignarSiDisponible(id.valor(), ahora,
                EstadoRequerimiento.SOLICITADO, EstadoRequerimiento.ASIGNADO);
    }

    @Override
    @Transactional
    public int expirarVencidos(Instant ahora) {
        return repository.expirarVencidos(ahora,
                EstadoRequerimiento.SOLICITADO, EstadoRequerimiento.SIN_PROVEEDOR);
    }
}
