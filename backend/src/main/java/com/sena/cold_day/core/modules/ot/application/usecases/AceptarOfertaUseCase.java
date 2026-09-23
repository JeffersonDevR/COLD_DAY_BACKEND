package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.events.OtAsignada;
import com.sena.cold_day.core.modules.ot.domain.exception.ConteoAuxiliaresInvalidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OfertaExpiradaException;
import com.sena.cold_day.core.modules.ot.domain.exception.OfertaNoDisponibleException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-09 / RNF-07 atomic acceptance (design D5). The conditional UPDATE on
 * the {@code ot} row is the cross-offer gate: only one concurrent accept can
 * flip {@code BUSCANDO_TECNICO -> ASIGNADA}. The winner then flips its own
 * offer ({@code WHERE estado='PENDIENTE' AND expira_en > ahora}), invalidates
 * the siblings, moves the technician to {@code OCUPADO}, appends the audited
 * {@code BUSCANDO_TECNICO -> ASIGNADA} history entry and publishes
 * {@link OtAsignada}. Every loser receives a domain conflict.
 *
 * <p>The whole flow is one transaction: if the technician can no longer take
 * the order (not approved / already busy) the assignment rolls back and the OT
 * returns to {@code BUSCANDO_TECNICO}. Expired offers are rejected lazily with
 * the injected {@link Clock}, so the sweep and the accept share one time source.
 */
@Service
public class AceptarOfertaUseCase {

    private final OfertaOtRepository ofertaRepository;
    private final OtRepository otRepository;
    private final OtEstadoHistorialRepository historialRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final int maxAuxiliares;

    public AceptarOfertaUseCase(OfertaOtRepository ofertaRepository, OtRepository otRepository,
            OtEstadoHistorialRepository historialRepository, TecnicoRepository tecnicoRepository,
            ApplicationEventPublisher events, Clock clock,
            @Value("${app.auxiliares.max:10}") int maxAuxiliares) {
        this.ofertaRepository = ofertaRepository;
        this.otRepository = otRepository;
        this.historialRepository = historialRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.events = events;
        this.clock = clock;
        this.maxAuxiliares = maxAuxiliares;
    }

    /** Acceptance without a body: zero auxiliares, exactly as before (aux.R1/S1.1). */
    @Transactional
    public OtResponse aceptar(UsuarioId usuarioId, OfertaOtId ofertaId) {
        return aceptar(usuarioId, ofertaId, 0);
    }

    @Transactional
    public OtResponse aceptar(UsuarioId usuarioId, OfertaOtId ofertaId, int auxiliaresRequeridos) {
        if (auxiliaresRequeridos < 0 || auxiliaresRequeridos > maxAuxiliares) {
            throw new ConteoAuxiliaresInvalidoException(
                    "auxiliaresRequeridos debe estar entre 0 y " + maxAuxiliares);
        }
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        Instant ahora = clock.instant();

        OfertaOt oferta = ofertaRepository.buscarPorId(ofertaId)
                .orElseThrow(() -> new OfertaNoDisponibleException(ofertaId));
        if (!tecnico.getId().equals(oferta.getTecnicoId())) {
            throw new OfertaNoDisponibleException(ofertaId);
        }
        if (oferta.getEstado() != OfertaEstado.PENDIENTE) {
            throw new OfertaNoDisponibleException(ofertaId);
        }
        if (!oferta.estaVigente(ahora)) {
            throw new OfertaExpiradaException(ofertaId);
        }

        OtId otId = oferta.getOtId();
        // AD2: the count rides the single conditional UPDATE; there is no post-bulk write.
        int asignadas = otRepository.intentarAsignar(otId, tecnico.getId(), ahora, oferta.getRadioKm(),
                auxiliaresRequeridos);
        if (asignadas == 0) {
            throw new OfertaNoDisponibleException(ofertaId);
        }

        if (ofertaRepository.intentarAceptar(ofertaId, ahora) == 0) {
            throw new OfertaNoDisponibleException(ofertaId);
        }
        ofertaRepository.invalidarPendientesDe(otId, OfertaEstado.CANCELADA, ahora);

        tecnico.aceptarOrden();
        tecnicoRepository.save(tecnico);

        historialRepository.append(OtEstadoHistorial.registrar(otId,
                CambioEstado.hacia(EstadoOt.BUSCANDO_TECNICO, EstadoOt.ASIGNADA, ActorOt.TECNICO, ahora)));

        Ot asignada = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        events.publishEvent(new OtAsignada(otId, tecnico.getId(), asignada.getClienteId()));
        return OtResponse.fromDomain(asignada);
    }
}
