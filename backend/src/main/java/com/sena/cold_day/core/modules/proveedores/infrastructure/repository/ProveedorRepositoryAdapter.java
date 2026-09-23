package com.sena.cold_day.core.modules.proveedores.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.ProveedorJpaEntity;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataProveedorRepository;

@Repository
public class ProveedorRepositoryAdapter implements ProveedorRepository {

    private final SpringDataProveedorRepository repository;

    public ProveedorRepositoryAdapter(SpringDataProveedorRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public Proveedor save(Proveedor proveedor) {
        ProveedorJpaEntity entity = proveedor.getId() == null
                ? ProveedorJpaEntity.fromDomain(proveedor)
                : repository.findById(proveedor.getId().valor())
                        .map(existing -> {
                            existing.applyFromDomain(proveedor);
                            return existing;
                        })
                        .orElseGet(() -> ProveedorJpaEntity.fromDomain(proveedor));
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Proveedor> buscarPorId(ProveedorId id) {
        return repository.findById(id.valor()).map(ProveedorJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Proveedor> findByUsuarioId(Long usuarioId) {
        return repository.findByUsuarioId(usuarioId).map(ProveedorJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Proveedor> findByActivoTrue() {
        return repository.findByActivoTrue().stream().map(ProveedorJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional
    public void deleteAll() {
        repository.deleteAll();
    }
}
