package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtFinalizada;
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
 * RF-F1-10: the assigned technician finishes the repair
 * ({@code EN_REPARACION -> FINALIZADA}), the technician is released back to
 * {@code DISPONIBLE} and {@link OtFinalizada} is published so real-time
 * tracking deactivates while the final coordinates remain for audit.
 */
@Service
public class FinalizarOtUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final EstimarTarifaUseCase estimarTarifa;

    public FinalizarOtUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository,
            ApplicationEventPublisher events, Clock clock, EstimarTarifaUseCase estimarTarifa) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.events = events;
        this.clock = clock;
        this.estimarTarifa = estimarTarifa;
    }

    @Transactional
    public OtResponse finalizar(UsuarioId usuarioId, OtId otId) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        if (!tecnico.getId().equals(ot.getTecnicoId())) {
            throw new TecnicoNoAsignadoException(otId, tecnico.getId());
        }

        Instant ahora = clock.instant();
        ot.finalizar(ActorOt.TECNICO, ahora);
        estimarTarifa.estimarPara(ot.getUbicacion()).ifPresent(tarifa -> ot.registrarTarifaVisita(
                tarifa.tarifa(), tarifa.distanciaKm(), tarifa.tarifaFuente(), ahora));
        Ot saved = otRepository.save(ot);
        tecnico.liberarOrden();
        tecnicoRepository.save(tecnico);
        events.publishEvent(new OtFinalizada(otId, saved.getTecnicoId()));
        return OtResponse.fromDomain(saved);
    }
}
