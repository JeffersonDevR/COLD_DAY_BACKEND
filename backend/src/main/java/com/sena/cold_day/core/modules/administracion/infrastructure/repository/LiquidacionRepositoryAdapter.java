package com.sena.cold_day.core.modules.administracion.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.infrastructure.persistence.LiquidacionJpaEntity;
import com.sena.cold_day.core.modules.administracion.infrastructure.persistence.SpringDataLiquidacionRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

@Repository
public class LiquidacionRepositoryAdapter implements LiquidacionRepository {

    private static final List<EstadoLiquidacion> ESTADOS_BLOQUEADORES = List.of(
            EstadoLiquidacion.PENDIENTE_CONSIGNACION,
            EstadoLiquidacion.EN_VERIFICACION,
            EstadoLiquidacion.RECHAZADA);

    private final SpringDataLiquidacionRepository repository;

    public LiquidacionRepositoryAdapter(SpringDataLiquidacionRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public Liquidacion save(Liquidacion liquidacion) {
        LiquidacionJpaEntity entity = liquidacion.getId() == null
                ? LiquidacionJpaEntity.fromDomain(liquidacion)
                : repository.findById(liquidacion.getId().valor())
                        .map(existing -> {
                            existing.applyFromDomain(liquidacion);
                            return existing;
                        })
                        .orElseGet(() -> LiquidacionJpaEntity.fromDomain(liquidacion));
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Liquidacion> buscarPorId(LiquidacionId id) {
        return repository.findById(id.valor()).map(LiquidacionJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Liquidacion> buscarPorOt(OtId otId) {
        return repository.findByOtId(otId.valor()).map(LiquidacionJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Liquidacion> buscarPorTecnico(TecnicoId tecnicoId) {
        return repository.findByTecnicoId(tecnicoId.valor()).stream()
                .map(LiquidacionJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Liquidacion> buscarPorEstado(EstadoLiquidacion estado) {
        return repository.findByEstado(estado).stream()
                .map(LiquidacionJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existeBloqueadoraPara(TecnicoId tecnicoId) {
        return repository.existsByTecnicoIdAndEstadoIn(tecnicoId.valor(), ESTADOS_BLOQUEADORES);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Liquidacion> listarTodas() {
        return repository.findAll().stream().map(LiquidacionJpaEntity::toDomain).toList();
    }
}
