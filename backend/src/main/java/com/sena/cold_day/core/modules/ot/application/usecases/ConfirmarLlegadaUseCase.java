package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@Service
public class ConfirmarLlegadaUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final Clock clock;

    public ConfirmarLlegadaUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository, Clock clock) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
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
        ot.confirmarLlegada(ActorOt.TECNICO, clock.instant());
        return OtResponse.fromDomain(otRepository.save(ot));
    }
}
