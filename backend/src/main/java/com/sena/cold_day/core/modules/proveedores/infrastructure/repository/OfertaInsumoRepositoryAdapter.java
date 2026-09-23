package com.sena.cold_day.core.modules.proveedores.infrastructure.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.OfertaInsumoJpaEntity;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataOfertaInsumoRepository;

/** Adapter for the insumo-offer port (design AD6). */
@Repository
public class OfertaInsumoRepositoryAdapter implements OfertaInsumoRepository {

    private final SpringDataOfertaInsumoRepository repository;

    public OfertaInsumoRepositoryAdapter(SpringDataOfertaInsumoRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public OfertaInsumo save(OfertaInsumo oferta) {
        OfertaInsumoJpaEntity entity = oferta.getId() == null
                ? OfertaInsumoJpaEntity.fromDomain(oferta)
                : repository.findById(oferta.getId().valor())
                        .map(existing -> {
                            existing.applyFromDomain(oferta);
                            return existing;
                        })
                        .orElseGet(() -> OfertaInsumoJpaEntity.fromDomain(oferta));
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OfertaInsumo> buscarPorId(OfertaInsumoId id) {
        return repository.findById(id.valor()).map(OfertaInsumoJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OfertaInsumo> listarPendientesPorRequerimiento(RequerimientoInsumoId requerimientoId) {
        return repository
                .findByRequerimientoIdAndEstadoOrderByCreadaEnAsc(requerimientoId.valor(),
                        OfertaInsumoEstado.PENDIENTE)
                .stream().map(OfertaInsumoJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<OfertaInsumo> listarPorProveedor(ProveedorId proveedorId, OfertaInsumoEstado... estados) {
        List<OfertaInsumoJpaEntity> encontradas = estados == null || estados.length == 0
                ? repository.findByProveedorId(proveedorId.valor())
                : repository.findByProveedorIdAndEstadoIn(proveedorId.valor(), List.of(estados));
        return encontradas.stream().map(OfertaInsumoJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional
    public int intentarAceptar(OfertaInsumoId id, Instant ahora) {
        return repository.aceptarSiVigente(id.valor(), ahora,
                OfertaInsumoEstado.PENDIENTE, OfertaInsumoEstado.ACEPTADA);
    }

    @Override
    @Transactional
    public void invalidarPendientesDe(RequerimientoInsumoId requerimientoId, OfertaInsumoEstado nuevo,
            Instant ahora) {
        repository.resolverPendientesDe(requerimientoId.valor(), ahora,
                OfertaInsumoEstado.PENDIENTE, nuevo);
    }

    @Override
    @Transactional
    public int expirarVencidas(Instant ahora) {
        return repository.expirarVencidas(ahora,
                OfertaInsumoEstado.PENDIENTE, OfertaInsumoEstado.EXPIRADA);
    }
}
