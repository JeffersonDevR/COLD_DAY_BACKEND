package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Duration;
import java.time.Instant;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtRequest;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtCreada;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * CU-08/RF-F1-08: an authenticated client creates an urgent OT. Creation lands
 * in {@code SOLICITADA} and immediately advances to {@code BUSCANDO_TECNICO}
 * with the initial 10 km / 60 s window. Offer broadcast is owned by PR6.
 */
@Service
public class CrearOtUseCase {

    private static final double RADIO_INICIAL_KM = 10.0;
    private static final Duration VENTANA_BUSQUEDA = Duration.ofSeconds(60);

    private final OtRepository otRepository;
    private final ClienteRepository clienteRepository;
    private final ApplicationEventPublisher events;

    public CrearOtUseCase(OtRepository otRepository, ClienteRepository clienteRepository,
            ApplicationEventPublisher events) {
        this.otRepository = otRepository;
        this.clienteRepository = clienteRepository;
        this.events = events;
    }

    @Transactional
    public OtResponse crear(OtRequest request, UsuarioId usuarioId) {
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));

        Instant ahora = Instant.now();
        Ot ot = Ot.crear(cliente.getId(), request.categoriaServicio(), request.descripcionFalla(),
                request.evidenciaUrls(), request.direccion(), request.ubicacion(), ahora);
        ot.iniciarBusqueda(RADIO_INICIAL_KM, ahora.plus(VENTANA_BUSQUEDA), ActorOt.CLIENTE, ahora);

        Ot saved = otRepository.save(ot);
        events.publishEvent(new OtCreada(saved.getId(), cliente.getId()));
        return OtResponse.fromDomain(saved);
    }
}
