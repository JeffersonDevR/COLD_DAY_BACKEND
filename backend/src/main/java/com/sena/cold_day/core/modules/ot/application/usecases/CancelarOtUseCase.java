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
import com.sena.cold_day.core.modules.ot.domain.exception.MotivoRequeridoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.services.TransicionesOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-21 cancellation (design D2) extended from the PR5 guard-only seam.
 *
 * <ul>
 *   <li>A mandatory free-text reason is required (400 otherwise).</li>
 *   <li>Cancellation is only legal before {@code EN_REPARACION}; the state
 *       machine rejects the repair phase with a conflict (409).</li>
 *   <li>The client has a 10-minute free window from {@code asignadaEn}; outside
 *       it the base visit fee is charged.</li>
 *   <li>{@code canceladaPor} is {@code CLIENTE} or {@code TECNICO}; a technician
 *       cancellation carries no reputation/priority penalty in this change
 *       (RF-F1-15 deferred).</li>
 *   <li>Any terminal path releases the assigned technician to
 *       {@code DISPONIBLE} and publishes {@link OtCancelada} for tracking.</li>
 * </ul>
 */
@Service
public class CancelarOtUseCase {

    private final OtRepository otRepository;
    private final ClienteRepository clienteRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final EstimarTarifaUseCase estimarTarifa;

    public CancelarOtUseCase(OtRepository otRepository, ClienteRepository clienteRepository,
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
    public OtResponse cancelar(UsuarioId usuarioId, Rol rol, OtId otId, String razon) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));

        // The state machine is the primary guard: repair-phase/terminal rejections are conflicts.
        TransicionesOt.validar(ot.getEstado(), EstadoOt.CANCELADA);

        ActorOt actor;
        MotivoCancelacion motivo;
        if (rol == Rol.CLIENTE) {
            Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                    .orElseThrow(() -> new ClienteNoEncontradoException(
                            "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
            if (!cliente.getId().equals(ot.getClienteId())) {
                throw new OtAccesoNoPermitidoException(otId);
            }
            actor = ActorOt.CLIENTE;
            motivo = MotivoCancelacion.CANCELACION_CLIENTE;
        } else {
            Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                    .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
            if (!tecnico.getId().equals(ot.getTecnicoId())) {
                throw new TecnicoNoAsignadoException(otId, tecnico.getId());
            }
            actor = ActorOt.TECNICO;
            motivo = MotivoCancelacion.CANCELACION_TECNICO;
        }

        if (razon == null || razon.isBlank()) {
            throw new MotivoRequeridoException();
        }

        Instant ahora = clock.instant();
        ot.cancelar(actor, motivo, razon, ahora, null);

        // Outside the free window the client is charged; the amount is computed
        // server-side and persisted with its distance and source (design AD13).
        if (actor == ActorOt.CLIENTE && ot.getAsignadaEn() != null && !ot.dentroDeVentanaGratuita(ahora)) {
            estimarTarifa.estimarPara(ot.getUbicacion()).ifPresent(tarifa -> ot.registrarTarifaVisita(
                    tarifa.tarifa(), tarifa.distanciaKm(), tarifa.tarifaFuente(), ahora));
        }

        Ot saved = otRepository.save(ot);
        liberarTecnico(saved.getTecnicoId());
        events.publishEvent(new OtCancelada(otId, actor, motivo, saved.getTecnicoId()));
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
