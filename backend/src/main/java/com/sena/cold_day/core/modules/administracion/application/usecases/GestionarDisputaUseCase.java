package com.sena.cold_day.core.modules.administracion.application.usecases;

import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.application.dto.DisputaResponse;
import com.sena.cold_day.core.modules.administracion.domain.entities.Disputa;
import com.sena.cold_day.core.modules.administracion.domain.events.DisputaAbierta;
import com.sena.cold_day.core.modules.administracion.domain.events.DisputaResuelta;
import com.sena.cold_day.core.modules.administracion.domain.exception.AdministracionConflictoException;
import com.sena.cold_day.core.modules.administracion.domain.exception.DisputaNoEncontradaException;
import com.sena.cold_day.core.modules.administracion.domain.repository.DisputaRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtCancelada;
import com.sena.cold_day.core.modules.ot.domain.events.OtFinalizada;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import java.time.Clock;

/**
 * RF-F1-25 (SRS §5.3): el cliente abre la disputa al rechazar el diagnostico o
 * el trabajo entregado; el administrador media y resuelve con acuerdo
 * (FINALIZADA) o sin acuerdo (CANCELADA sin cobro, motivo auditado).
 */
@Service
public class GestionarDisputaUseCase {

    private final OtRepository otRepository;
    private final ClienteRepository clienteRepository;
    private final TecnicoRepository tecnicoRepository;
    private final DisputaRepository disputaRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public GestionarDisputaUseCase(OtRepository otRepository, ClienteRepository clienteRepository,
            TecnicoRepository tecnicoRepository, DisputaRepository disputaRepository,
            ApplicationEventPublisher events, Clock clock) {
        this.otRepository = otRepository;
        this.clienteRepository = clienteRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.disputaRepository = disputaRepository;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public DisputaResponse abrir(UsuarioId usuarioId, OtId otId, String motivo) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
        if (!cliente.getId().equals(ot.getClienteId())) {
            throw new OtAccesoNoPermitidoException(otId);
        }
        if (disputaRepository.buscarAbiertaPorOt(otId).isPresent()) {
            throw new AdministracionConflictoException("La orden ya tiene una disputa abierta");
        }
        ot.abrirDisputa(ActorOt.CLIENTE, motivo, clock.instant());
        Ot guardada = otRepository.save(ot);
        Disputa disputa = disputaRepository.save(Disputa.abrir(guardada.getId(), motivo, clock.instant()));
        events.publishEvent(new DisputaAbierta(disputa.getId()));
        return DisputaResponse.fromDomain(disputa);
    }

    @Transactional
    public DisputaResponse resolver(DisputaId disputaId, boolean conAcuerdo, String resolucion) {
        Disputa disputa = disputaRepository.buscarPorId(disputaId)
                .orElseThrow(() -> new DisputaNoEncontradaException(disputaId));
        Ot ot = otRepository.buscarPorId(disputa.getOtId())
                .orElseThrow(() -> new OtNoEncontradoException(disputa.getOtId()));
        if (conAcuerdo) {
            disputa.resolverConAcuerdo(resolucion, clock.instant());
            ot.resolverDisputaConAcuerdo(ActorOt.ADMINISTRADOR, clock.instant());
        } else {
            disputa.resolverSinAcuerdo(resolucion, clock.instant());
            ot.resolverDisputaSinAcuerdo(ActorOt.ADMINISTRADOR, resolucion, clock.instant());
        }
        Disputa guardada = disputaRepository.save(disputa);
        Ot otGuardada = otRepository.save(ot);
        liberarTecnico(otGuardada.getTecnicoId());
        if (conAcuerdo) {
            events.publishEvent(new OtFinalizada(otGuardada.getId(), otGuardada.getTecnicoId()));
        } else {
            events.publishEvent(new OtCancelada(otGuardada.getId(), ActorOt.ADMINISTRADOR,
                    MotivoCancelacion.RESOLUCION_DISPUTA_SIN_ACUERDO, otGuardada.getTecnicoId()));
        }
        events.publishEvent(new DisputaResuelta(guardada.getId(), conAcuerdo));
        return DisputaResponse.fromDomain(guardada);
    }

    @Transactional(readOnly = true)
    public List<DisputaResponse> listarAbiertas() {
        return disputaRepository.buscarPorEstado(EstadoDisputa.ABIERTA).stream()
                .map(DisputaResponse::fromDomain).toList();
    }

    @Transactional(readOnly = true)
    public List<DisputaResponse> listarTodas() {
        return disputaRepository.listarTodas().stream()
                .map(DisputaResponse::fromDomain).toList();
    }

    /** La OT resuelta libera al tecnico asignado (vuelve a DISPONIBLE si aplica). */
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
