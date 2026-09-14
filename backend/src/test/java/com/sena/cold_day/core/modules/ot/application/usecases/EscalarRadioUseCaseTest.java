package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtSinTecnicosDisponibles;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.services.NotificacionPushPort;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Radius escalation and negative terminal state (task 6a.4, RF-F1-09): when a
 * 60-second window closes with no acceptance the radius grows by 5 km
 * (10 -> 15 -> 20 -> 25) and the order is re-broadcast; at 25 km it becomes
 * {@code SIN_TECNICOS_DISPONIBLES} and the client is notified. Duplicate or
 * illegal escalation is a guarded no-op.
 */
@ExtendWith(MockitoExtension.class)
class EscalarRadioUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(60);

    @Mock OtRepository otRepository;
    @Mock OfertaOtRepository ofertaRepository;
    @Mock IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    @Mock NotificacionPushPort notificacionPush;
    @Mock ApplicationEventPublisher events;

    private EscalarRadioUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new EscalarRadioUseCase(otRepository, ofertaRepository, iniciarBusqueda,
                notificacionPush, events, Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void escalatesTheRadiusByFiveKilometersAndRebroadcastsWhenTheWindowExpires() {
        Ot ot = otBuscando(10.0, AHORA);
        cuandoHayVencidas(ot);
        cuandoElOtSeGuarda();

        int procesadas = useCase.ejecutar();

        assertThat(procesadas).isEqualTo(1);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        assertThat(ot.getRadioKm()).isEqualTo(15.0);
        assertThat(ot.getVentanaExpiraEn()).isEqualTo(EXPIRA);
        verify(ofertaRepository).expirarDe(ot.getId(), AHORA);
        verify(iniciarBusqueda).ofrecer(ot, 15.0, AHORA);
        verify(notificacionPush, never()).notificarCliente(any(), any(), anyString());
        verify(events, never()).publishEvent(any());
    }

    @Test
    void reachesTheNegativeTerminalStateAtTheMaximumRadiusAndNotifiesTheClient() {
        Ot ot = otBuscando(25.0, AHORA);
        cuandoHayVencidas(ot);
        cuandoElOtSeGuarda();

        int procesadas = useCase.ejecutar();

        assertThat(procesadas).isEqualTo(1);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.SIN_TECNICOS_DISPONIBLES);
        assertThat(ot.esTerminal()).isTrue();
        verify(ofertaRepository).expirarDe(ot.getId(), AHORA);
        verify(notificacionPush).notificarCliente(eq(ot.getClienteId()), eq(ot), anyString());
        verify(events).publishEvent(any(OtSinTecnicosDisponibles.class));
        verify(iniciarBusqueda, never()).ofrecer(any(), anyDouble(), any());
    }

    @Test
    void duplicateEscalationIsANoOp() {
        Ot ot = otBuscando(10.0, AHORA);
        cuandoHayVencidas(ot);
        cuandoElOtSeGuarda();

        assertThat(useCase.ejecutar()).isEqualTo(1);
        assertThat(useCase.ejecutar()).isZero();

        assertThat(ot.getRadioKm()).isEqualTo(15.0);
        verify(iniciarBusqueda).ofrecer(ot, 15.0, AHORA);
    }

    @Test
    void processesEveryExpiredWindowInOneSweep() {
        Ot escalable = otBuscando(10.0, AHORA);
        Ot agotada = otBuscando(25.0, AHORA);
        cuandoHayVencidas(escalable, agotada);
        cuandoElOtSeGuarda();

        assertThat(useCase.ejecutar()).isEqualTo(2);

        assertThat(escalable.getRadioKm()).isEqualTo(15.0);
        assertThat(agotada.getEstado()).isEqualTo(EstadoOt.SIN_TECNICOS_DISPONIBLES);
        verify(iniciarBusqueda).ofrecer(escalable, 15.0, AHORA);
        verify(notificacionPush).notificarCliente(eq(agotada.getClienteId()), eq(agotada), anyString());
    }

    @Test
    void ignoresOrdersThatAreNotSearchingEvenIfTheyCarryAnExpiredWindow() {
        Ot cancelada = otBuscando(10.0, AHORA);
        cancelada.cancelar(ActorOt.CLIENTE, MotivoCancelacion.CANCELACION_CLIENTE, AHORA);
        cuandoHayVencidas(cancelada);

        assertThat(useCase.ejecutar()).isZero();

        assertThat(cancelada.getEstado()).isEqualTo(EstadoOt.CANCELADA);
    }

    @Test
    void doesNothingWhenNoWindowHasExpired() {
        cuandoHayVencidas();

        assertThat(useCase.ejecutar()).isZero();

        verifyNoInteractions(ofertaRepository, iniciarBusqueda, notificacionPush, events);
    }

    private Ot otBuscando(double radioKm, Instant ventanaExpiraEn) {
        Ot ot = Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), AHORA);
        ot.iniciarBusqueda(radioKm, ventanaExpiraEn, ActorOt.CLIENTE, AHORA);
        ot.drenarCambiosPendientes();
        return ot;
    }

    private void cuandoHayVencidas(Ot... ordenes) {
        when(otRepository.buscarVentanasVencidas(AHORA)).thenReturn(List.of(ordenes));
    }

    private void cuandoElOtSeGuarda() {
        when(otRepository.save(any(Ot.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }
}
