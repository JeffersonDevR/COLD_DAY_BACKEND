package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Instant;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtCancelada;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * PR5 seam: cancellation guarded only by the state machine (RF-F1-10). The
 * mandatory reason, free window and visit fee are owned by PR7 (task 7.6).
 */
@Service
public class CancelarOtUseCase {

    private final OtRepository otRepository;
    private final ApplicationEventPublisher events;

    public CancelarOtUseCase(OtRepository otRepository, ApplicationEventPublisher events) {
        this.otRepository = otRepository;
        this.events = events;
    }

    @Transactional
    public OtResponse cancelar(OtId otId, ActorOt actor, MotivoCancelacion motivo) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        ot.cancelar(actor, motivo, Instant.now());
        Ot saved = otRepository.save(ot);
        events.publishEvent(new OtCancelada(otId, actor, motivo, saved.getTecnicoId()));
        return OtResponse.fromDomain(saved);
    }
}
