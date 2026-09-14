package com.sena.cold_day.core.modules.ot.infrastructure.repository;

import java.util.List;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.OtEstadoHistorialJpaEntity;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;

@Repository
public class OtEstadoHistorialRepositoryAdapter implements OtEstadoHistorialRepository {

    private final SpringDataOtEstadoHistorialRepository repository;

    public OtEstadoHistorialRepositoryAdapter(SpringDataOtEstadoHistorialRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public OtEstadoHistorial append(OtEstadoHistorial entrada) {
        return repository.saveAndFlush(OtEstadoHistorialJpaEntity.fromDomain(entrada)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public List<OtEstadoHistorial> listarPorOt(OtId otId) {
        return repository.findByOtIdOrderByOcurridoEnAscIdAsc(otId.valor()).stream()
                .map(OtEstadoHistorialJpaEntity::toDomain)
                .toList();
    }
}
