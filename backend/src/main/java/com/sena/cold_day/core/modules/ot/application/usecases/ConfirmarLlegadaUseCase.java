package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtLlegadaConfirmada;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-14: the assigned technician confirms the arrival on site.
 *
 * <p>The aggregate is idempotent: a replay keeps the original arrival instant
 * instead of overwriting it, so the real arrival time cannot be falsified by
 * a retry. The same replay must not produce a second event either, otherwise
 * every retry would wake the order stream up again with an arrival that
 * already happened. That is why the event is published only when the
 * confirmation actually moved the order forward.
 */
@Service
public class ConfirmarLlegadaUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ConfirmarLlegadaUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository,
            ApplicationEventPublisher events, Clock clock) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public OtResponse confirmar(UsuarioId usuarioId, OtId otId) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        if (!tecnico.getId().equals(ot.getTecnicoId())) {
            throw new TecnicoNoAsignadoException(otId, tecnico.getId());
        }
        Instant llegadaPrevia = ot.getLlegadaEn();
        ot.confirmarLlegada(ActorOt.TECNICO, clock.instant());
        Ot guardada = otRepository.save(ot);
        if (llegadaPrevia == null && guardada.getLlegadaEn() != null) {
            events.publishEvent(new OtLlegadaConfirmada(guardada.getId(), guardada.getEstado(),
                    guardada.getLlegadaEn()));
        }
        return OtResponse.fromDomain(guardada);
    }
}
