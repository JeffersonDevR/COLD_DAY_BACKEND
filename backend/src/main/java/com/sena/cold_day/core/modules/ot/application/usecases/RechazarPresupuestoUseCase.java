package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtCancelada;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-20 / design D1 (documented divergence from SRS §5.2): client rejection
 * terminates the OT as {@code CANCELADA} with {@code motivo=RECHAZO_PRESUPUESTO}
 * and the base visit fee, releases the assigned technician and publishes
 * {@link OtCancelada} so tracking deactivates. Only the owning client may reject.
 */
@Service
public class RechazarPresupuestoUseCase {

    private final OtRepository otRepository;
    private final ClienteRepository clienteRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final EstimarTarifaUseCase estimarTarifa;

    public RechazarPresupuestoUseCase(OtRepository otRepository, ClienteRepository clienteRepository,
            TecnicoRepository tecnicoRepository, ApplicationEventPublisher events, Clock clock,
            EstimarTarifaUseCase estimarTarifa) {
        this.otRepository = otRepository;
        this.clienteRepository = clienteRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.events = events;
        this.clock = clock;
        this.estimarTarifa = estimarTarifa;
    }

    @Transactional
    public OtResponse rechazar(UsuarioId usuarioId, OtId otId, String razon) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
        if (!cliente.getId().equals(ot.getClienteId())) {
            throw new OtAccesoNoPermitidoException(otId);
        }

        Instant ahora = clock.instant();
        String motivo = razon == null || razon.isBlank() ? "Rechazo del presupuesto" : razon;
        ot.cancelar(ActorOt.CLIENTE, MotivoCancelacion.RECHAZO_PRESUPUESTO, motivo, ahora, null);
        estimarTarifa.estimarPara(ot.getUbicacion()).ifPresent(tarifa -> ot.registrarTarifaVisita(
                tarifa.tarifa(), tarifa.distanciaKm(), tarifa.tarifaFuente(), ahora));
        Ot saved = otRepository.save(ot);
        liberarTecnico(saved.getTecnicoId());
        events.publishEvent(new OtCancelada(otId, ActorOt.CLIENTE, MotivoCancelacion.RECHAZO_PRESUPUESTO,
                saved.getTecnicoId()));
        return OtResponse.fromDomain(saved);
    }

    /** A terminal OT returns an approved assigned technician to DISPONIBLE. */
    private void liberarTecnico(TecnicoId tecnicoId) {
        if (tecnicoId == null) {
            return;
        }
        tecnicoRepository.findByIdAndActivoTrue(tecnicoId).ifPresent(tecnico -> {
            tecnico.liberarOrden();
            tecnicoRepository.save(tecnico);
        });
    }
}
