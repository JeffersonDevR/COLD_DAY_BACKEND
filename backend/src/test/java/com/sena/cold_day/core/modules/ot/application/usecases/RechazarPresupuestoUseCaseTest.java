package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtCancelada;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * RF-F1-20 / design D1 (task 7.5): rejection terminates the OT as CANCELADA
 * with motivo RECHAZO_PRESUPUESTO and the base visit fee, releases the assigned
 * technician and publishes {@link OtCancelada} so tracking deactivates.
 */
@ExtendWith(MockitoExtension.class)
class RechazarPresupuestoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);

    @Mock OtRepository otRepository;
    @Mock ClienteRepository clienteRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock ApplicationEventPublisher events;

    private RechazarPresupuestoUseCase useCase;

    @BeforeEach
    void setup() {
        useCase = new RechazarPresupuestoUseCase(otRepository, clienteRepository, tecnicoRepository,
                events, Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void rechazarCancelsWithTheVisitFeeReleasesTheTechnicianAndPublishesTheEvent() {
        Cliente cliente = cliente();
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otEnDiagnostico(cliente.getId(), tecnico.getId());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));

        OtResponse response = useCase.rechazar(PRINCIPAL, ot.getId(), "Presupuesto muy alto");

        assertThat(response.estado()).isEqualTo(EstadoOt.CANCELADA);
        assertThat(response.motivoCancelacion()).isEqualTo(MotivoCancelacion.RECHAZO_PRESUPUESTO);
        assertThat(response.canceladaPor()).isEqualTo(ActorOt.CLIENTE);
        assertThat(response.tarifaVisita()).isEqualByComparingTo(Ot.TARIFA_VISITA_BASE);
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);

        ArgumentCaptor<OtCancelada> captor = ArgumentCaptor.forClass(OtCancelada.class);
        verify(events).publishEvent(captor.capture());
        assertThat(captor.getValue().motivo()).isEqualTo(MotivoCancelacion.RECHAZO_PRESUPUESTO);
        assertThat(captor.getValue().tecnicoAsignado()).contains(tecnico.getId());
    }

    @Test
    void rechazarRejectsAClientThatDoesNotOwnTheOrder() {
        Cliente cliente = cliente();
        Ot ot = otEnDiagnostico(ClienteId.nueva(), TecnicoId.nueva());
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente));
        var otId = ot.getId();

        assertThatThrownBy(() -> useCase.rechazar(PRINCIPAL, otId, "No me sirve"))
                .isInstanceOf(OtAccesoNoPermitidoException.class);

        verify(otRepository, never()).save(any());
        verify(events, never()).publishEvent(any());
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_DIAGNOSTICO);
    }

    private Cliente cliente() {
        return Cliente.registrar(PRINCIPAL, TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro"));
    }

    private Tecnico tecnicoOcupado() {
        Tecnico tecnico = Tecnico.crear(USUARIO_ID, "123", Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        tecnico.aceptarOrden();
        return tecnico;
    }

    private Ot otEnDiagnostico(ClienteId clienteId, TecnicoId tecnicoId) {
        Presupuesto presupuesto = new Presupuesto(new BigDecimal("120000.00"), new BigDecimal("350000.00"), AHORA);
        return Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0), EstadoOt.EN_DIAGNOSTICO, 10.0,
                AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null, null, presupuesto);
    }
}
