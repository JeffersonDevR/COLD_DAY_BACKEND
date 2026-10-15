package com.sena.cold_day.core.modules.ot.infrastructure.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.OtJpaEntity;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

import jakarta.persistence.EntityManager;

/**
 * Adapter for the OT aggregate. Saving drains the aggregate's pending
 * {@link CambioEstado} list into the append-only history in the same
 * transaction, so no accepted transition is ever lost (RNF-09, design D3).
 */
@Repository
public class OtRepositoryAdapter implements OtRepository {

    /**
     * Highest sequence already issued for a year in the {@code OT-YYYY-####} codes,
     * or 0 when the year has none. The regex guard rejects any code that is not one
     * of ours, so a code edited by hand cannot blow the cast up and, with it, every
     * creation of that year.
     */
    private static final String ULTIMO_NUMERO_CODIGO = """
            SELECT COALESCE(MAX(split_part(codigo, '-', 3)::bigint), 0)
            FROM ot
            WHERE codigo LIKE CONCAT('OT-', :anio, '-%')
              AND codigo ~ '^OT-[0-9]{4}-[0-9]{1,12}$'
            """;

    private final SpringDataOtRepository repository;
    private final OtEstadoHistorialRepository historialRepository;
    private final ApplicationEventPublisher events;
    private final EntityManager entityManager;

    public OtRepositoryAdapter(SpringDataOtRepository repository,
            OtEstadoHistorialRepository historialRepository, ApplicationEventPublisher events,
            EntityManager entityManager) {
        this.repository = repository;
        this.historialRepository = historialRepository;
        this.events = events;
        this.entityManager = entityManager;
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
            // Deliberate compromise: the domain should own event publication, but
            // the aggregate cannot reach the publisher without a Spring dependency.
            // This drain loop is the single choke point every state-changing save
            // passes through, so publishing here covers the transitions that have
            // no dedicated domain event (EN_CAMINO, EN_DIAGNOSTICO, EN_REPARACION)
            // without touching a dozen use cases that would drift apart. The list
            // only contains real changes, so nothing is published when the state
            // did not change.
            events.publishEvent(new OtEstadoCambiado(ot.getId(), cambio.origen(), cambio.destino()));
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
    public List<Ot> buscarPorIds(Collection<OtId> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<UUID> valores = ids.stream().filter(id -> id != null).map(OtId::valor).toList();
        if (valores.isEmpty()) {
            return List.of();
        }
        return repository.findAllById(valores).stream().map(OtJpaEntity::toDomain).toList();
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

    /**
     * Native SQL because the number lives inside the code string: splitting the
     * third dash-separated part and casting it to a number is not expressible in
     * JPQL without relying on the cast support of one Hibernate version. The
     * statement joins whatever transaction is open, so a caller that reads it right
     * before inserting the order that consumes the number sees its own rows.
     */
    @Override
    public int ultimoNumeroCodigo(int anio) {
        Number ultimo = (Number) entityManager.createNativeQuery(ULTIMO_NUMERO_CODIGO)
                .setParameter("anio", anio)
                .getSingleResult();
        return ultimo == null ? 0 : ultimo.intValue();
    }
}
