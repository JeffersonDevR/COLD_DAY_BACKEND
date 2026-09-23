package com.sena.cold_day.core.modules.proveedores.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
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

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;

/**
 * Trigger side of the dispatch (spec disp.R1/R3/R6, design AD11): one pending
 * offer per eligible active supplier, notifications only after the authoritative
 * writes, zero lines create nothing, zero eligible suppliers resolve the request
 * to {@code SIN_PROVEEDOR}, and a failing notifier never changes the state.
 */
@ExtendWith(MockitoExtension.class)
class SolicitarInsumoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long VIGENCIA_MS = 900_000L;
    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();
    private static final List<InsumoLinea> LINEAS = List.of(new InsumoLinea("Filtro secadora", 2));

    @Mock RequerimientoInsumoRepository requerimientoRepository;
    @Mock OfertaInsumoRepository ofertaRepository;
    @Mock ProveedorRepository proveedorRepository;
    @Mock NotificacionInsumoPort notificacion;

    private SolicitarInsumoUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new SolicitarInsumoUseCase(requerimientoRepository, ofertaRepository, proveedorRepository,
                notificacion, Clock.fixed(AHORA, ZoneOffset.UTC), VIGENCIA_MS);
    }

    @Test
    void broadcastsOnePendingOfferPerActiveSupplierAndNotifiesAfterTheWrite() {
        when(requerimientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ofertaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(proveedorRepository.findByActivoTrue())
                .thenReturn(List.of(proveedor("900-1"), proveedor("900-2")));

        Optional<RequerimientoInsumo> resultado = useCase.solicitar(OT_ID, TECNICO_ID, LINEAS, "Compresor ruidoso");

        assertThat(resultado).hasValueSatisfying(req -> {
            assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);
            assertThat(req.getOtId()).isEqualTo(OT_ID);
            assertThat(req.getTecnicoId()).isEqualTo(TECNICO_ID);
            assertThat(req.getExpiraEn()).isEqualTo(AHORA.plusMillis(VIGENCIA_MS));
        });

        verify(requerimientoRepository).save(any());
        ArgumentCaptor<OfertaInsumo> ofertas = ArgumentCaptor.forClass(OfertaInsumo.class);
        verify(ofertaRepository, times(2)).save(ofertas.capture());
        assertThat(ofertas.getAllValues()).allSatisfy(oferta -> {
            assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.PENDIENTE);
            assertThat(oferta.getExpiraEn()).isEqualTo(AHORA.plusMillis(VIGENCIA_MS));
        });

        // AD11: the authoritative request/offers are written before the notify call.
        InOrder orden = inOrder(requerimientoRepository, ofertaRepository, notificacion);
        orden.verify(requerimientoRepository).save(any());
        orden.verify(ofertaRepository).save(any());
        orden.verify(notificacion).notificarSolicitud(any(), any(), any());
        verify(notificacion, times(2)).notificarSolicitud(any(), any(), any());
    }

    @Test
    void resolvesToSinProveedorWhenThereAreNoEligibleSuppliers() {
        when(requerimientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(proveedorRepository.findByActivoTrue()).thenReturn(List.of());

        Optional<RequerimientoInsumo> resultado = useCase.solicitar(OT_ID, TECNICO_ID, LINEAS, null);

        assertThat(resultado).hasValueSatisfying(req -> {
            assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR);
            assertThat(req.getResueltaEn()).isEqualTo(AHORA);
        });
        verify(ofertaRepository, never()).save(any());
        verify(notificacion, never()).notificarSolicitud(any(), any(), any());
    }

    @Test
    void createsNothingWhenThereAreNoLines() {
        assertThat(useCase.solicitar(OT_ID, TECNICO_ID, List.of(), null)).isEmpty();

        verifyNoInteractions(requerimientoRepository, ofertaRepository, proveedorRepository, notificacion);
    }

    @Test
    void aFailingNotifierLeavesTheRequestAndOffersAuthoritative() {
        when(requerimientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(ofertaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(proveedorRepository.findByActivoTrue())
                .thenReturn(List.of(proveedor("900-1"), proveedor("900-2")));
        doThrow(new IllegalStateException("push caido"))
                .when(notificacion).notificarSolicitud(any(), any(), any());

        assertThatCode(() -> useCase.solicitar(OT_ID, TECNICO_ID, LINEAS, null)).doesNotThrowAnyException();

        verify(requerimientoRepository).save(any());
        verify(ofertaRepository, times(2)).save(any());
        verify(notificacion, times(2)).notificarSolicitud(any(), any(), any());
    }

    private Proveedor proveedor(String nit) {
        return Proveedor.crear(100L + nit.hashCode(), "Suministros " + nit, nit, "3105550001", null, null,
                Set.of());
    }
}
