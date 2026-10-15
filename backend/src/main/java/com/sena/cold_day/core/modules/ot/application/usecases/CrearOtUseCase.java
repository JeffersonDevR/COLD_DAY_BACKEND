package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;

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
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * CU-08/RF-F1-08: an authenticated client creates an urgent OT. Creation lands
 * in {@code SOLICITADA} and immediately hands off to
 * {@link IniciarBusquedaTecnicoUseCase}, which advances to
 * {@code BUSCANDO_TECNICO} and broadcasts the first offers (design data flow).
 *
 * <p>This is the single place where the human-readable code
 * ({@link CodigoOt}, {@code OT-YYYY-####}) is allocated: the number is the
 * highest one already issued for the UTC year of the creation instant plus one,
 * read inside this transaction ({@link OtRepository#ultimoNumeroCodigo(int)}),
 * and the code is assigned to the aggregate before it is saved. An order
 * therefore reaches the table with a code or not at all.
 */
@Service
public class CrearOtUseCase {

    private final ClienteRepository clienteRepository;
    private final IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    private final OtRepository otRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public CrearOtUseCase(ClienteRepository clienteRepository, IniciarBusquedaTecnicoUseCase iniciarBusqueda,
            OtRepository otRepository, ApplicationEventPublisher events, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.iniciarBusqueda = iniciarBusqueda;
        this.otRepository = otRepository;
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
        // Allocated after the aggregate exists (a rejected request must not burn a
        // number) and before it is saved (the first save happens inside iniciar), so
        // the code travels in the INSERT that creates the order. The year is read
        // from `ahora`, the instant that also stamps creadaEn, so a code can never
        // disagree with the year of the order it belongs to.
        int anio = Year.from(ahora.atZone(ZoneOffset.UTC)).getValue();
        ot.asignarCodigo(CodigoOt.formatear(anio, otRepository.ultimoNumeroCodigo(anio) + 1));
        Ot saved = iniciarBusqueda.iniciar(ot);
        events.publishEvent(new OtCreada(saved.getId(), cliente.getId()));
        return OtResponse.fromDomain(saved);
    }
}
