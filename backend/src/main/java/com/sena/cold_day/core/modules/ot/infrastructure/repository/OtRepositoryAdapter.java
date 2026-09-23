package com.sena.cold_day.core.modules.ot.infrastructure.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.OtJpaEntity;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Adapter for the OT aggregate. Saving drains the aggregate's pending
 * {@link CambioEstado} list into the append-only history in the same
 * transaction, so no accepted transition is ever lost (RNF-09, design D3).
 */
@Repository
public class OtRepositoryAdapter implements OtRepository {

    private final SpringDataOtRepository repository;
    private final OtEstadoHistorialRepository historialRepository;

    public OtRepositoryAdapter(SpringDataOtRepository repository,
            OtEstadoHistorialRepository historialRepository) {
        this.repository = repository;
        this.historialRepository = historialRepository;
    }

    @Override
    @Transactional
    public Ot save(Ot ot) {
        OtJpaEntity entity = ot.getId() == null
                ? OtJpaEntity.fromDomain(ot)
                : repository.findById(ot.getId().valor())
                        .map(existing -> {
                            existing.applyFromDomain(ot);
                            return existing;
                        })
                        .orElseGet(() -> OtJpaEntity.fromDomain(ot));
        OtJpaEntity persisted = repository.saveAndFlush(entity);

        for (CambioEstado cambio : ot.drenarCambiosPendientes()) {
            historialRepository.append(OtEstadoHistorial.registrar(ot.getId(), cambio));
        }
        return persisted.toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Ot> buscarPorId(OtId id) {
        return repository.findById(id.valor()).map(OtJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ot> buscarPorEstado(EstadoOt estado) {
        return repository.findByEstado(estado).stream().map(OtJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ot> buscarPorCliente(ClienteId clienteId) {
        return repository.findByClienteId(clienteId.valor()).stream().map(OtJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ot> buscarPorTecnico(TecnicoId tecnicoId) {
        return repository.findByTecnicoId(tecnicoId.valor()).stream().map(OtJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ot> listarTodas() {
        return repository.findAll().stream().map(OtJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional
    public int intentarAsignar(OtId id, TecnicoId tecnicoId, Instant ahora, double radioKm) {
        return intentarAsignar(id, tecnicoId, ahora, radioKm, 0);
    }

    @Override
    @Transactional
    public int intentarAsignar(OtId id, TecnicoId tecnicoId, Instant ahora, double radioKm,
            int auxiliaresRequeridos) {
        return repository.asignarSiDisponible(id.valor(), tecnicoId.valor(), ahora, radioKm,
                auxiliaresRequeridos, EstadoOt.BUSCANDO_TECNICO, EstadoOt.ASIGNADA);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ot> buscarVentanasVencidas(Instant ahora) {
        return repository.findByEstadoAndVentanaExpiraEnLessThanEqual(EstadoOt.BUSCANDO_TECNICO, ahora)
                .stream().map(OtJpaEntity::toDomain).toList();
    }
}
