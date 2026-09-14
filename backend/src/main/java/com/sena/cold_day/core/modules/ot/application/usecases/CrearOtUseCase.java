package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
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
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * CU-08/RF-F1-08: an authenticated client creates an urgent OT. Creation lands
 * in {@code SOLICITADA} and immediately hands off to
 * {@link IniciarBusquedaTecnicoUseCase}, which advances to
 * {@code BUSCANDO_TECNICO} and broadcasts the first offers (design data flow).
 */
@Service
public class CrearOtUseCase {

    private final ClienteRepository clienteRepository;
    private final IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public CrearOtUseCase(ClienteRepository clienteRepository, IniciarBusquedaTecnicoUseCase iniciarBusqueda,
            ApplicationEventPublisher events, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.iniciarBusqueda = iniciarBusqueda;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public OtResponse crear(OtRequest request, UsuarioId usuarioId) {
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));

        Instant ahora = clock.instant();
        Ot ot = Ot.crear(cliente.getId(), request.categoriaServicio(), request.descripcionFalla(),
                request.evidenciaUrls(), request.direccion(), request.ubicacion(), ahora);
        Ot saved = iniciarBusqueda.iniciar(ot);
        events.publishEvent(new OtCreada(saved.getId(), cliente.getId()));
        return OtResponse.fromDomain(saved);
    }
}
