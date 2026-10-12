package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtCancelada;
import com.sena.cold_day.core.modules.ot.domain.exception.MotivoRequeridoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.services.TransicionesOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
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
 *
 * <p>Attribution is resource-based (design D5): with dual roles a caller may own
 * the OT's cliente row, be its assigned technician, or both. The actor is
 * inferred from the OT's rows when unambiguous; when the same user is both the
 * owning client and the assigned technician of the same OT, the cancellation is
 * genuinely ambiguous and an explicit {@code actorRol} is mandatory (M4) — the
 * system never guesses.
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

    /**
     * @param actorRol the explicit actor for a dual user, or {@code null} to infer
     *                 it from the OT's cliente/tecnico rows.
     */
    @Transactional
    public OtResponse cancelar(UsuarioId usuarioId, OtId otId, String razon, ActorOt actorRol) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));

        // The state machine is the primary guard: repair-phase/terminal rejections are conflicts.
        TransicionesOt.validar(ot.getEstado(), EstadoOt.CANCELADA);

        ActorOt actor = resolverActor(ot, otId, usuarioId, actorRol);
        MotivoCancelacion motivo = actor == ActorOt.CLIENTE
                ? MotivoCancelacion.CANCELACION_CLIENTE
                : MotivoCancelacion.CANCELACION_TECNICO;

        if (razon == null || razon.isBlank()) {
            throw new MotivoRequeridoException();
        }

        Instant ahora = clock.instant();
        ot.cancelar(actor, motivo, razon, ahora, null);

        // Outside the free window the client is charged; the amount is computed
        // server-side and persisted with its distance and source (design AD13).
        if (actor == ActorOt.CLIENTE && ot.getAsignadaEn() != null && !ot.dentroDeVentanaGratuita(ahora)) {
            registrarTarifaAutoritativa(ot, ahora);
        }

        Ot saved = otRepository.save(ot);
        liberarTecnico(saved.getTecnicoId());
        events.publishEvent(new OtCancelada(otId, actor, motivo, saved.getTecnicoId()));
        return OtResponse.fromDomain(saved);
    }

    /**
     * Resolves the cancellation actor from the resource. An explicit
     * {@code actorRol} is honored only when the caller actually holds that role on
     * this OT; otherwise the actor is inferred — owning client first, then the
     * assigned technician. When the caller is both, attribution is ambiguous and
     * the request is rejected rather than guessed (M4).
     */
    private ActorOt resolverActor(Ot ot, OtId otId, UsuarioId usuarioId, ActorOt actorRol) {
        boolean esClientePropietario = clienteRepository.findByUsuarioId(usuarioId)
                .map(cliente -> cliente.getId().equals(ot.getClienteId()))
                .orElse(false);
        boolean esTecnicoAsignado = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .map(tecnico -> tecnico.getId().equals(ot.getTecnicoId()))
                .orElse(false);

        if (actorRol != null) {
            if (actorRol == ActorOt.CLIENTE && esClientePropietario) {
                return ActorOt.CLIENTE;
            }
            if (actorRol == ActorOt.TECNICO && esTecnicoAsignado) {
                return ActorOt.TECNICO;
            }
            throw new OtAccesoNoPermitidoException(otId);
        }
        if (esClientePropietario && esTecnicoAsignado) {
            throw new OtAccesoNoPermitidoException(otId);
        }
        if (esClientePropietario) {
            return ActorOt.CLIENTE;
        }
        if (esTecnicoAsignado) {
            return ActorOt.TECNICO;
        }
        throw new OtAccesoNoPermitidoException(otId);
    }

    /**
     * Persists the authoritative visit tariff for the OT's destination. A
     * location-less OT (legacy row) has no destination to price, so no tariff,
     * distance or source is persisted — an explicit, observable no-op rather
     * than a silent skip (tar.R6).
     */
    private void registrarTarifaAutoritativa(Ot ot, Instant ahora) {
        if (ot.getUbicacion() == null) {
            return;
        }
        estimarTarifa.estimarPara(ot.getUbicacion()).ifPresent(tarifa -> ot.registrarTarifaVisita(
                tarifa.tarifa(), tarifa.distanciaKm(), tarifa.tarifaFuente(), ahora));
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
