package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
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
import com.sena.cold_day.core.modules.maps.application.usecases.MapsUseCase;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtCancelada;
import com.sena.cold_day.core.modules.ot.domain.exception.MotivoRequeridoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TransicionOtInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.ot.infrastructure.config.TarifaProperties;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * RF-F1-21 cancellation (task 7.6): mandatory reason, blocked after repair
 * starts, 10-minute free window from assignment, actor attribution without a
 * technician penalty in this change, and technician release on every terminal
 * path.
 */
@ExtendWith(MockitoExtension.class)
class CancelarOtUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long USUARIO_ID = 7L;
    private static final UsuarioId PRINCIPAL = new UsuarioId(USUARIO_ID);

    @Mock OtRepository otRepository;
    @Mock ClienteRepository clienteRepository;
    @Mock TecnicoRepository tecnicoRepository;
    @Mock ApplicationEventPublisher events;
    @Mock MapsUseCase maps;

    private CancelarOtUseCase useCase;

    @BeforeEach
    void setup() {
        TarifaProperties props = new TarifaProperties(0, 0, 0, null, null, 0, 0, null);
        useCase = new CancelarOtUseCase(otRepository, clienteRepository, tecnicoRepository, events,
                Clock.fixed(AHORA, ZoneOffset.UTC), new EstimarTarifaUseCase(maps, props));
    }

    @Test
    void clientCancelsInsideTheFreeWindowWithoutVisitFee() {
        Cliente cliente = cliente();
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otAsignada(cliente.getId(), tecnico.getId(), AHORA);
        cuandoResuelveCliente(cliente, ot, tecnico);

        OtResponse response = useCase.cancelar(PRINCIPAL, Rol.CLIENTE, ot.getId(), "Ya no la necesito");

        assertThat(response.estado()).isEqualTo(EstadoOt.CANCELADA);
        assertThat(response.canceladaPor()).isEqualTo(ActorOt.CLIENTE);
        assertThat(response.motivoCancelacion()).isEqualTo(MotivoCancelacion.CANCELACION_CLIENTE);
        assertThat(response.tarifaVisita()).isNull();
        assertThat(ot.getDistanciaKm()).isNull();
        assertThat(ot.getTarifaFuente()).isNull();
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);
    }

    @Test
    void clientCancelsOutsideTheFreeWindowChargingTheVisitFee() {
        Cliente cliente = cliente();
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otAsignada(cliente.getId(), tecnico.getId(), AHORA.minus(Duration.ofMinutes(20)));
        cuandoResuelveCliente(cliente, ot, tecnico);

        OtResponse response = useCase.cancelar(PRINCIPAL, Rol.CLIENTE, ot.getId(), "Tarde");

        assertThat(response.estado()).isEqualTo(EstadoOt.CANCELADA);
        assertThat(response.tarifaVisita()).isEqualByComparingTo("30000");
        assertThat(ot.getDistanciaKm()).isZero();
        assertThat(ot.getTarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
    }

    @Test
    void cancelRejectsAMissingReasonAndPersistsNothing() {
        Cliente cliente = cliente();
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otAsignada(cliente.getId(), tecnico.getId(), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente));
        var otId = ot.getId();

        assertThatThrownBy(() -> useCase.cancelar(PRINCIPAL, Rol.CLIENTE, otId, "  "))
                .isInstanceOf(MotivoRequeridoException.class);

        verify(otRepository, never()).save(any());
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.ASIGNADA);
    }

    @Test
    void cancelIsBlockedOnceRepairStarted() {
        Ot ot = Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), TecnicoId.nueva(),
                CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0),
                EstadoOt.EN_REPARACION, 10.0, AHORA.plusSeconds(60), AHORA, AHORA, null, null, null, null,
                null, null);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        var otId = ot.getId();

        assertThatThrownBy(() -> useCase.cancelar(PRINCIPAL, Rol.CLIENTE, otId, "Ya no"))
                .isInstanceOf(TransicionOtInvalidaException.class);

        verify(otRepository, never()).save(any());
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.EN_REPARACION);
    }

    @Test
    void technicianCancelsWithoutVisitFeeAndIsReleased() {
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otAsignada(ClienteId.nueva(), tecnico.getId(), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));

        OtResponse response = useCase.cancelar(PRINCIPAL, Rol.TECNICO, ot.getId(), "No puedo atender");

        assertThat(response.estado()).isEqualTo(EstadoOt.CANCELADA);
        assertThat(response.motivoCancelacion()).isEqualTo(MotivoCancelacion.CANCELACION_TECNICO);
        assertThat(response.tarifaVisita()).isNull();
        assertThat(tecnico.getEstadoOperativo()).isEqualTo(EstadoOperativo.DISPONIBLE);

        ArgumentCaptor<OtCancelada> captor = ArgumentCaptor.forClass(OtCancelada.class);
        verify(events).publishEvent(captor.capture());
        assertThat(captor.getValue().motivo()).isEqualTo(MotivoCancelacion.CANCELACION_TECNICO);
    }

    @Test
    void cancelRejectsANonAssignedTechnician() {
        Tecnico tecnico = tecnicoOcupado();
        Ot ot = otAsignada(ClienteId.nueva(), TecnicoId.nueva(), AHORA);
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(tecnicoRepository.findByUsuarioIdAndActivoTrue(USUARIO_ID)).thenReturn(Optional.of(tecnico));
        var otId = ot.getId();

        assertThatThrownBy(() -> useCase.cancelar(PRINCIPAL, Rol.TECNICO, otId, "No puedo"))
                .isInstanceOf(TecnicoNoAsignadoException.class);

        verify(otRepository, never()).save(any());
    }

    private void cuandoResuelveCliente(Cliente cliente, Ot ot, Tecnico tecnico) {
        when(otRepository.buscarPorId(ot.getId())).thenReturn(Optional.of(ot));
        when(clienteRepository.findByUsuarioId(PRINCIPAL)).thenReturn(Optional.of(cliente));
        when(otRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).thenReturn(Optional.of(tecnico));
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

    private Ot otAsignada(ClienteId clienteId, TecnicoId tecnicoId, Instant asignadaEn) {
        return Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", new Point(7.8939, -72.5078), EstadoOt.ASIGNADA, 10.0,
                AHORA.plusSeconds(60), AHORA, asignadaEn, null, null, null, null, null, null);
    }
}
