package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.DiagnosticoRequest;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-11: the assigned technician records the detected fault and the budget
 * (labor + parts), advancing {@code EN_CAMINO -> EN_DIAGNOSTICO} and presenting
 * the budget to the client. A non-assigned technician is a 403 and nothing is
 * persisted.
 */
@Service
public class RegistrarDiagnosticoUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final Clock clock;

    public RegistrarDiagnosticoUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository,
            Clock clock) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.clock = clock;
    }

    @Transactional
    public OtResponse registrar(UsuarioId usuarioId, OtId otId, DiagnosticoRequest request) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        if (!tecnico.getId().equals(ot.getTecnicoId())) {
            throw new TecnicoNoAsignadoException(otId, tecnico.getId());
        }

        Instant ahora = clock.instant();
        Diagnostico diagnostico = new Diagnostico(request.fallaDetectada(), request.observaciones(), ahora);
        Presupuesto presupuesto = new Presupuesto(request.costoManoObra(), request.costoRepuestos(), ahora);

        ot.registrarDiagnostico(diagnostico, ActorOt.TECNICO, ahora);
        ot.presupuestar(presupuesto);
        return OtResponse.fromDomain(otRepository.save(ot));
    }
}
