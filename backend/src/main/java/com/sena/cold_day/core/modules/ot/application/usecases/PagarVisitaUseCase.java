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
import com.sena.cold_day.core.modules.ot.domain.events.OtVisitaPagada;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@Service
public class PagarVisitaUseCase {

    private final ClienteRepository clienteRepository;
    private final OtRepository otRepository;
    private final OfertaOtRepository ofertaRepository;
    private final IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public PagarVisitaUseCase(ClienteRepository clienteRepository, OtRepository otRepository,
            OfertaOtRepository ofertaRepository, IniciarBusquedaTecnicoUseCase iniciarBusqueda,
            ApplicationEventPublisher events, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.otRepository = otRepository;
        this.ofertaRepository = ofertaRepository;
        this.iniciarBusqueda = iniciarBusqueda;
        this.events = events;
        this.clock = clock;
    }

    /**
     * RF-F1-26: cobra la visita y aplica el efecto que corresponda al estado.
     * Desde {@code SOLICITADA} la busqueda arranca con
     * {@link IniciarBusquedaTecnicoUseCase#iniciar}; desde una {@code CANCELADA}
     * por rechazo de presupuesto la reapertura pasa por
     * {@link Ot#reabrirDespachoTrasPagoVisita}, nunca por el camino generico,
     * para que la guarda de motivo/pago no se pueda saltar. Desde
     * {@code ASIGNADA} (WS5) solo se registra el cobro: no hay transicion y la
     * OT sigue asignada, pero el tecnico ya puede iniciar el desplazamiento.
     */
    @Transactional
    public OtResponse pagar(UsuarioId usuarioId, OtId otId, String medioPago) {
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        if (!cliente.getId().equals(ot.getClienteId())) {
            throw new OtAccesoNoPermitidoException(otId);
        }
        Instant ahora = clock.instant();
        ot.registrarPagoVisita(medioPago, ahora);
        Ot guardada = aplicarEfectosDelPago(ot, ahora);
        // The payment is a fact, not a transition: an ASIGNADA order stays
        // assigned, so no CambioEstado is produced and the repository drain
        // loop - the only publisher of the generic state-change event - stays
        // silent. This event is what tells the technician that the visit is
        // already paid and that the displacement can start.
        events.publishEvent(new OtVisitaPagada(guardada.getId(), guardada.getEstado(),
                guardada.getVisitaPagadaEn()));
        return OtResponse.fromDomain(guardada);
    }

    /**
     * Elige el efecto del pago segun el estado de la OT. Una {@code ASIGNADA}
     * solo registra el cobro (WS5: sin transicion, el estado no avanza). Una
     * {@code CANCELADA} (que el agregado solo reabre si fue por rechazo de
     * presupuesto y ya esta pagada) reusa el mismo primitivo de oferta que el
     * arranque normal, para que la reapertura produzca exactamente los mismos
     * efectos observables: ventana de despacho, ofertas y notificaciones push.
     *
     * <p>Antes de re-ofertar cierra las ofertas {@code PENDIENTE} que la orden
     * todavia tuviera vivas (p. ej. si fue cancelada mientras despachaba), igual
     * que {@link EscalarRadioUseCase}: sin ese cierre el mismo tecnico recibiria
     * una segunda oferta {@code PENDIENTE} para la misma OT.
     */
    private Ot aplicarEfectosDelPago(Ot ot, Instant ahora) {
        if (ot.getEstado() == EstadoOt.ASIGNADA) {
            return otRepository.save(ot);
        }
        if (ot.getEstado() != EstadoOt.CANCELADA) {
            return iniciarBusqueda.iniciar(ot);
        }
        ot.reabrirDespachoTrasPagoVisita(IniciarBusquedaTecnicoUseCase.RADIO_INICIAL_KM,
                ahora.plus(IniciarBusquedaTecnicoUseCase.VENTANA_BUSQUEDA), ActorOt.CLIENTE, ahora);
        Ot guardada = otRepository.save(ot);
        ofertaRepository.expirarDe(guardada.getId(), ahora);
        iniciarBusqueda.ofrecer(guardada, IniciarBusquedaTecnicoUseCase.RADIO_INICIAL_KM, ahora);
        return guardada;
    }
}
