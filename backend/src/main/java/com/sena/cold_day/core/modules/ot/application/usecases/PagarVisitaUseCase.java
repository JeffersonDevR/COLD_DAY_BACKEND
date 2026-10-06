package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@Service
public class PagarVisitaUseCase {

    private final ClienteRepository clienteRepository;
    private final OtRepository otRepository;
    private final IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    private final Clock clock;

    public PagarVisitaUseCase(ClienteRepository clienteRepository, OtRepository otRepository,
            IniciarBusquedaTecnicoUseCase iniciarBusqueda, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.otRepository = otRepository;
        this.iniciarBusqueda = iniciarBusqueda;
        this.clock = clock;
    }

    /**
     * RF-F1-26: cobra la visita y deja la OT despachando. Desde {@code SOLICITADA}
     * la busqueda arranca con {@link IniciarBusquedaTecnicoUseCase#iniciar}; desde
     * una {@code CANCELADA} por rechazo de presupuesto la reapertura pasa por
     * {@link Ot#reabrirDespachoTrasPagoVisita}, nunca por el camino generico, para
     * que la guarda de motivo/pago no se pueda saltar.
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
        return OtResponse.fromDomain(reabrirDespacho(ot, ahora));
    }

    /**
     * Elige el camino de reapertura segun el estado de la OT. Una
     * {@code CANCELADA} (que el agregado solo reabre si fue por rechazo de
     * presupuesto y ya esta pagada) reusa el mismo primitivo de oferta que el
     * arranque normal, para que la reapertura produzca exactamente los mismos
     * efectos observables: ventana de despacho, ofertas y notificaciones push.
     */
    private Ot reabrirDespacho(Ot ot, Instant ahora) {
        if (ot.getEstado() != EstadoOt.CANCELADA) {
            return iniciarBusqueda.iniciar(ot);
        }
        ot.reabrirDespachoTrasPagoVisita(IniciarBusquedaTecnicoUseCase.RADIO_INICIAL_KM,
                ahora.plus(IniciarBusquedaTecnicoUseCase.VENTANA_BUSQUEDA), ActorOt.CLIENTE, ahora);
        Ot guardada = otRepository.save(ot);
        iniciarBusqueda.ofrecer(guardada, IniciarBusquedaTecnicoUseCase.RADIO_INICIAL_KM, ahora);
        return guardada;
    }
}
