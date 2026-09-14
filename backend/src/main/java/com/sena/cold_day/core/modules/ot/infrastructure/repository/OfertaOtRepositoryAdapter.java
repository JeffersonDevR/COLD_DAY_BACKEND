package com.sena.cold_day.core.modules.ot.infrastructure.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.OfertaOtJpaEntity;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOfertaOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/** Adapter for the dispatch-offer port (design D4/D5). */
@Repository
public class OfertaOtRepositoryAdapter implements OfertaOtRepository {

    private final SpringDataOfertaOtRepository repository;

    public OfertaOtRepositoryAdapter(SpringDataOfertaOtRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public OfertaOt save(OfertaOt oferta) {
        OfertaOtJpaEntity entity = oferta.getId() == null
                ? OfertaOtJpaEntity.fromDomain(oferta)
                : repository.findById(oferta.getId().valor())
                        .map(existing -> {
                            existing.applyFromDomain(oferta);
                            return existing;
                        })
                        .orElseGet(() -> OfertaOtJpaEntity.fromDomain(oferta));
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OfertaOt> buscarPorId(OfertaOtId id) {
        return repository.findById(id.valor()).map(OfertaOtJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OfertaOt> listarPendientesPorOt(OtId otId) {
        return repository.findByOtIdAndEstadoOrderByCreadaEnAsc(otId.valor(), OfertaEstado.PENDIENTE)
                .stream().map(OfertaOtJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<OfertaOt> listarPorTecnico(TecnicoId tecnicoId, OfertaEstado... estados) {
        List<OfertaOtJpaEntity> encontradas = estados == null || estados.length == 0
                ? repository.findByTecnicoId(tecnicoId.valor())
                : repository.findByTecnicoIdAndEstadoIn(tecnicoId.valor(), List.of(estados));
        return encontradas.stream().map(OfertaOtJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional
    public int intentarAceptar(OfertaOtId id, Instant ahora) {
        return repository.aceptarSiVigente(id.valor(), ahora,
                OfertaEstado.PENDIENTE, OfertaEstado.ACEPTADA);
    }

    @Override
    @Transactional
    public void invalidarPendientesDe(OtId otId, OfertaEstado nuevo, Instant ahora) {
        repository.resolverPendientesDe(otId.valor(), ahora, OfertaEstado.PENDIENTE, nuevo);
    }

    @Override
    @Transactional
    public void expirarDe(OtId otId, Instant ahora) {
        repository.resolverPendientesDe(otId.valor(), ahora, OfertaEstado.PENDIENTE, OfertaEstado.EXPIRADA);
    }
}
