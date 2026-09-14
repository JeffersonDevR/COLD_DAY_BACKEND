package com.sena.cold_day.core.modules.ot.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.geolocalizacion.domain.repository.TecnicoDisponibilidadRepository;
import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.services.NotificacionPushPort;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Dispatch start (task 6a.3, RF-F1-09): from {@code SOLICITADA} the use case
 * advances to {@code BUSCANDO_TECNICO}, broadcasts one pending 60-second offer
 * per eligible technician in the initial 10 km radius and notifies each one
 * through the push port without blocking dispatch.
 */
@ExtendWith(MockitoExtension.class)
class IniciarBusquedaTecnicoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(60);
    private static final Point BOGOTA = new Point(4.6, -74.0);

    @Mock OtRepository otRepository;
    @Mock OfertaOtRepository ofertaRepository;
    @Mock TecnicoDisponibilidadRepository disponibilidadRepository;
    @Mock NotificacionPushPort notificacionPush;

    private IniciarBusquedaTecnicoUseCase useCase;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(AHORA, ZoneOffset.UTC);
        useCase = new IniciarBusquedaTecnicoUseCase(otRepository, ofertaRepository,
                disponibilidadRepository, notificacionPush, clock);
    }

    @Test
    void searchesTheInitialRadiusAndCreatesOnePendingOfferPerEligibleTechnician() {
        TecnicoId primero = TecnicoId.nueva();
        TecnicoId segundo = TecnicoId.nueva();
        cuandoHayDisponibles(new TecnicoCercano(primero, 1.5), new TecnicoCercano(segundo, 4.2));
        cuandoElOtSeGuarda();
        cuandoLaOfertaSeGuarda();
        Ot ot = otSolicitada();

        Ot resultado = useCase.iniciar(ot);

        assertThat(resultado.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        assertThat(resultado.getRadioKm()).isEqualTo(10.0);
        assertThat(resultado.getVentanaExpiraEn()).isEqualTo(EXPIRA);

        ArgumentCaptor<OfertaOt> ofertas = ArgumentCaptor.forClass(OfertaOt.class);
        verify(ofertaRepository, times(2)).save(ofertas.capture());
        assertThat(ofertas.getAllValues())
                .extracting(OfertaOt::getTecnicoId)
                .containsExactlyInAnyOrder(primero, segundo);
        assertThat(ofertas.getAllValues()).allSatisfy(oferta -> {
            assertThat(oferta.getEstado()).isEqualTo(OfertaEstado.PENDIENTE);
            assertThat(oferta.getRadioKm()).isEqualTo(10.0);
            assertThat(oferta.getCreadaEn()).isEqualTo(AHORA);
            assertThat(oferta.getExpiraEn()).isEqualTo(EXPIRA);
        });

        verify(disponibilidadRepository).buscarDisponiblesEnRadio(BOGOTA, 10.0,
                Set.of(CategoriaServicio.REFRIGERACION));
        verify(notificacionPush, times(2)).notificarOferta(any(TecnicoId.class), any(OfertaOt.class), eq(resultado));
        verify(otRepository).save(ot);
    }

    @Test
    void searchesEvenWithoutEligibleTechniciansAndStillTransitionsToSearching() {
        cuandoHayDisponibles();
        cuandoElOtSeGuarda();
        Ot ot = otSolicitada();

        Ot resultado = useCase.iniciar(ot);

        assertThat(resultado.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        assertThat(resultado.getVentanaExpiraEn()).isEqualTo(EXPIRA);
        verify(ofertaRepository, never()).save(any());
        verify(notificacionPush, never()).notificarOferta(any(), any(), any());
    }

    @Test
    void rebroadcastOffersAtTheNewRadiusWithoutChangingTheState() {
        TecnicoId tecnico = TecnicoId.nueva();
        cuandoHayDisponibles(new TecnicoCercano(tecnico, 12.0));
        cuandoLaOfertaSeGuarda();
        Ot ot = otSolicitada();
        ot.iniciarBusqueda(10.0, EXPIRA, ActorOt.CLIENTE, AHORA);
        ot.drenarCambiosPendientes();

        int ofertadas = useCase.ofrecer(ot, 15.0, AHORA.plusSeconds(60));

        assertThat(ofertadas).isEqualTo(1);
        assertThat(ot.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
        assertThat(ot.getRadioKm()).isEqualTo(10.0);
        ArgumentCaptor<OfertaOt> ofertas = ArgumentCaptor.forClass(OfertaOt.class);
        verify(ofertaRepository).save(ofertas.capture());
        assertThat(ofertas.getValue().getRadioKm()).isEqualTo(15.0);
        assertThat(ofertas.getValue().getTecnicoId()).isEqualTo(tecnico);
    }

    private Ot otSolicitada() {
        return Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", BOGOTA, AHORA);
    }

    private void cuandoHayDisponibles(TecnicoCercano... cercanos) {
        when(disponibilidadRepository.buscarDisponiblesEnRadio(any(), anyDouble(), anySet()))
                .thenReturn(List.of(cercanos));
    }

    private void cuandoElOtSeGuarda() {
        when(otRepository.save(any(Ot.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private void cuandoLaOfertaSeGuarda() {
        when(ofertaRepository.save(any(OfertaOt.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }
}
