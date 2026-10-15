package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.application.dto.OtRequest;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * T1 of ot-ux-ids-y-nombres: the human-readable code ({@code OT-YYYY-####}) is
 * allocated at creation, continues the per-year sequence of the year it belongs
 * to and is already on the aggregate by the time the order is saved.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CrearOtUseCaseTest {

    private static final UsuarioId PRINCIPAL = new UsuarioId(7L);
    private static final Instant AHORA_2026 = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant AHORA_2027 = Instant.parse("2027-01-02T00:00:00Z");

    @Mock OtRepository otRepository;
    @Mock ClienteRepository clienteRepository;
    @Mock IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    @Mock ApplicationEventPublisher events;

    private ClienteId clienteId;

    @BeforeEach
    void setUp() {
        clienteId = ClienteId.nueva();
        when(clienteRepository.findByUsuarioId(PRINCIPAL))
                .thenReturn(Optional.of(Cliente.reconstituir(clienteId, PRINCIPAL, TipoCliente.B2C,
                        DireccionPrincipal.con("Calle 1", "Cúcuta", "Centro", null), true)));
        // The dispatch use case is the first save of the order; returning the same
        // instance keeps the aggregate under test instead of a rebuilt copy.
        when(iniciarBusqueda.iniciar(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void crearAssignsTheNextCodeOfTheYearBeforeSavingTheOrder() {
        when(otRepository.ultimoNumeroCodigo(2026)).thenReturn(6);

        var respuesta = useCase(AHORA_2026).crear(request(), PRINCIPAL);

        assertThat(respuesta.id()).isNotNull();
        assertThat(respuesta.codigo()).isEqualTo(CodigoOt.de("OT-2026-0007"));
        ArgumentCaptor<Ot> guardada = ArgumentCaptor.forClass(Ot.class);
        verify(iniciarBusqueda).iniciar(guardada.capture());
        assertThat(guardada.getValue().getCodigo()).isEqualTo(CodigoOt.de("OT-2026-0007"));
    }

    @Test
    void crearRestartsTheSequenceOnTheNewYear() {
        when(otRepository.ultimoNumeroCodigo(2027)).thenReturn(0);

        var respuesta = useCase(AHORA_2027).crear(request(), PRINCIPAL);

        assertThat(respuesta.codigo()).isEqualTo(CodigoOt.de("OT-2027-0001"));
        verify(otRepository).ultimoNumeroCodigo(2027);
    }

    @Test
    void codigoPadsTheSequenceAndDoesNotWrapPastFourDigits() {
        assertThat(CodigoOt.formatear(2026, 7).valor()).isEqualTo("OT-2026-0007");
        assertThat(CodigoOt.formatear(2026, 10000).valor()).isEqualTo("OT-2026-10000");
    }

    private CrearOtUseCase useCase(Instant ahora) {
        return new CrearOtUseCase(clienteRepository, iniciarBusqueda, otRepository, events,
                Clock.fixed(ahora, ZoneOffset.UTC));
    }

    private OtRequest request() {
        return new OtRequest(CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1",
                new Point(7.8, -72.5));
    }
}
