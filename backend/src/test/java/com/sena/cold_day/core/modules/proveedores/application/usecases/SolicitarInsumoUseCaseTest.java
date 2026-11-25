package com.sena.cold_day.core.modules.proveedores.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.CalculadoraEtaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorCercano;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Trigger side of the dispatch (spec disp.R1/R3/R6, design AD11 + radius design
 * 2026-11-25): the request is broadcast by radius from the delivery point, one
 * pending offer per eligible supplier with its distance and suggested ETA,
 * notifications only after the authoritative writes, zero lines create nothing,
 * nobody inside the radius leaves the request {@code SOLICITADO} (the sweep
 * escalates it), and a failing notifier never changes the state.
 */
@ExtendWith(MockitoExtension.class)
class SolicitarInsumoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long VIGENCIA_MS = 900_000L;
    private static final double RADIO_INICIAL_KM = 10.0;
    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();
    private static final Point DESTINO = new Point(4.6097, -74.0817);
    private static final List<InsumoLinea> LINEAS = List.of(new InsumoLinea("Filtro secadora", 2));

    @Mock RequerimientoInsumoRepository requerimientoRepository;
    @Mock OfertaInsumoRepository ofertaRepository;
    @Mock ProveedorRepository proveedorRepository;
    @Mock NotificacionInsumoPort notificacion;

    private SolicitarInsumoUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new SolicitarInsumoUseCase(requerimientoRepository, ofertaRepository, proveedorRepository,
                notificacion, new CalculadoraEtaInsumo(30.0, 240), Clock.fixed(AHORA, ZoneOffset.UTC),
                VIGENCIA_MS, RADIO_INICIAL_KM);
    }

    @Test
    void createsTheRequestWithRadius10AndAWindowOfAQuarterOfTheVigencia() {
        when(requerimientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(proveedorRepository.buscarElegiblesEnRadio(DESTINO, RADIO_INICIAL_KM)).thenReturn(List.of());

        Optional<RequerimientoInsumo> resultado = useCase.solicitar(OT_ID, TECNICO_ID, DESTINO, LINEAS, "obs");

        assertThat(resultado).hasValueSatisfying(req -> {
            assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);
            assertThat(req.getOtId()).isEqualTo(OT_ID);
            assertThat(req.getTecnicoId()).isEqualTo(TECNICO_ID);
            assertThat(req.getDestino()).isEqualTo(DESTINO);
            assertThat(req.getRadioKm()).isEqualTo(RADIO_INICIAL_KM);
            assertThat(req.getExpiraEn()).isEqualTo(AHORA.plusMillis(VIGENCIA_MS));
            assertThat(req.getVentanaExpiraEn()).isEqualTo(AHORA.plusMillis(VIGENCIA_MS / 4));
        });
    }

    @Test
    void nobodyInsideTheRadiusLeavesTheRequestOpenForTheEscalationSweep() {
        when(requerimientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(proveedorRepository.buscarElegiblesEnRadio(DESTINO, RADIO_INICIAL_KM)).thenReturn(List.of());

        Optional<RequerimientoInsumo> resultado = useCase.solicitar(OT_ID, TECNICO_ID, DESTINO, LINEAS, null);

        assertThat(resultado).hasValueSatisfying(req -> {
            assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);
            assertThat(req.getResueltaEn()).isNull();
        });
        verify(ofertaRepository, never()).save(any());
        verify(notificacion, never()).notificarSolicitud(any(), any(), any());
    }

    @Test
    void offersOnlyToSuppliersInTheRadiusWithDistanceAndSuggestedEtaAndNotifiesAfterTheWrite() {
        ProveedorId cerca = ProveedorId.nueva();
        ProveedorId lejos = ProveedorId.nueva();
        when(requerimientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ofertaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(proveedorRepository.buscarElegiblesEnRadio(DESTINO, RADIO_INICIAL_KM))
                .thenReturn(List.of(new ProveedorCercano(cerca, 3.0), new ProveedorCercano(lejos, 9.0)));

        Optional<RequerimientoInsumo> resultado = useCase.solicitar(OT_ID, TECNICO_ID, DESTINO, LINEAS, "obs");

        ArgumentCaptor<OfertaInsumo> ofertas = ArgumentCaptor.forClass(OfertaInsumo.class);
        verify(ofertaRepository, times(2)).save(ofertas.capture());
        assertThat(ofertas.getAllValues()).extracting(OfertaInsumo::getProveedorId).containsExactly(cerca, lejos);
        assertThat(ofertas.getAllValues()).extracting(OfertaInsumo::getDistanciaKm).containsExactly(3.0, 9.0);
        // 3 km / 30 km/h = 6 min; 9 km / 30 km/h = 18 min.
        assertThat(ofertas.getAllValues()).extracting(OfertaInsumo::getEtaSugeridoMinutos).containsExactly(6, 18);
        assertThat(ofertas.getAllValues()).allSatisfy(oferta -> {
            assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.PENDIENTE);
            assertThat(oferta.getExpiraEn()).isEqualTo(resultado.orElseThrow().getExpiraEn());
        });

        // AD11: the authoritative request/offers are written before the notify call.
        InOrder orden = inOrder(requerimientoRepository, ofertaRepository, notificacion);
        orden.verify(requerimientoRepository).save(any());
        orden.verify(ofertaRepository).save(any());
        orden.verify(notificacion).notificarSolicitud(any(), any(), any());
        verify(notificacion, times(2)).notificarSolicitud(any(), any(), any());
    }

    @Test
    void ofrecerDoesNotOfferTwiceToASupplierThatAlreadyHasAnOffer() {
        ProveedorId yaOfertado = ProveedorId.nueva();
        ProveedorId nuevo = ProveedorId.nueva();
        RequerimientoInsumo requerimiento = RequerimientoInsumo.crear(OT_ID, TECNICO_ID, LINEAS, null, AHORA,
                AHORA.plusMillis(VIGENCIA_MS), DESTINO, RADIO_INICIAL_KM, AHORA.plusMillis(VIGENCIA_MS / 4));
        when(ofertaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ofertaRepository.proveedoresOfertados(requerimiento.getId())).thenReturn(Set.of(yaOfertado));
        when(proveedorRepository.buscarElegiblesEnRadio(DESTINO, 15.0))
                .thenReturn(List.of(new ProveedorCercano(yaOfertado, 4.0), new ProveedorCercano(nuevo, 12.0)));

        int ofrecidas = useCase.ofrecer(requerimiento, 15.0, AHORA);

        assertThat(ofrecidas).isEqualTo(1);
        ArgumentCaptor<OfertaInsumo> captor = ArgumentCaptor.forClass(OfertaInsumo.class);
        verify(ofertaRepository).save(captor.capture());
        assertThat(captor.getValue().getProveedorId()).isEqualTo(nuevo);
        verify(notificacion, times(1)).notificarSolicitud(any(), any(), any());
    }

    @Test
    void createsNothingWhenThereAreNoLines() {
        assertThat(useCase.solicitar(OT_ID, TECNICO_ID, DESTINO, List.of(), null)).isEmpty();
        assertThat(useCase.solicitar(OT_ID, TECNICO_ID, null, null, null)).isEmpty();

        verifyNoInteractions(requerimientoRepository, ofertaRepository, proveedorRepository, notificacion);
    }

    @Test
    void rejectsALackOfDestinationWhenThereAreLines() {
        assertThatThrownBy(() -> useCase.solicitar(OT_ID, TECNICO_ID, null, LINEAS, null))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(requerimientoRepository, ofertaRepository, notificacion);
    }

    @Test
    void aFailingNotifierLeavesTheRequestAndOffersAuthoritative() {
        when(requerimientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ofertaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(proveedorRepository.buscarElegiblesEnRadio(DESTINO, RADIO_INICIAL_KM)).thenReturn(
                List.of(new ProveedorCercano(ProveedorId.nueva(), 2.0), new ProveedorCercano(ProveedorId.nueva(), 5.0)));
        doThrow(new IllegalStateException("push caido"))
                .when(notificacion).notificarSolicitud(any(), any(), any());

        assertThatCode(() -> useCase.solicitar(OT_ID, TECNICO_ID, DESTINO, LINEAS, null)).doesNotThrowAnyException();

        verify(requerimientoRepository).save(any());
        verify(ofertaRepository, times(2)).save(any());
        verify(notificacion, times(2)).notificarSolicitud(any(), any(), any());
    }
}
