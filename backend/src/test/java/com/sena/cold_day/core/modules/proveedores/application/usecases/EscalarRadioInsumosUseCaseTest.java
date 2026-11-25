package com.sena.cold_day.core.modules.proveedores.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Escalation sweep of the insumo radius (design 2026-11-25): every open request
 * whose window closed without an accepting supplier widens by 5 km up to 25 km
 * and is offered to the suppliers of the new ring. Beyond 25 km nothing happens
 * here: the expiry sweep resolves the request to {@code SIN_PROVEEDOR}.
 */
@ExtendWith(MockitoExtension.class)
class EscalarRadioInsumosUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final long VENTANA_MS = 225_000L;
    private static final Point DESTINO = new Point(4.6097, -74.0817);

    @Mock RequerimientoInsumoRepository requerimientoRepository;
    @Mock SolicitarInsumoUseCase solicitarInsumo;

    private EscalarRadioInsumosUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new EscalarRadioInsumosUseCase(requerimientoRepository, solicitarInsumo,
                Clock.fixed(AHORA, ZoneOffset.UTC), 25.0, 5.0);
    }

    @Test
    void widensFrom10To15WhenTheWindowClosedAndOffersToTheNewRing() {
        RequerimientoInsumo req = abierto(10.0, AHORA.minusSeconds(1), AHORA.plusSeconds(600));
        when(solicitarInsumo.ventanaMs()).thenReturn(VENTANA_MS);
        when(requerimientoRepository.buscarEscalables(AHORA)).thenReturn(List.of(req));
        when(requerimientoRepository.escalarSiAbierto(req.getId(), 15.0, AHORA.plusMillis(VENTANA_MS)))
                .thenReturn(1);

        int escaladas = useCase.ejecutar();

        assertThat(escaladas).isEqualTo(1);
        assertThat(req.getRadioKm()).isEqualTo(15.0);
        assertThat(req.getVentanaExpiraEn()).isEqualTo(AHORA.plusMillis(VENTANA_MS));
        verify(requerimientoRepository, never()).save(any());
        verify(solicitarInsumo).ofrecer(req, 15.0, AHORA);
    }

    @Test
    void theNewWindowNeverOutlastsTheRequestExpiry() {
        RequerimientoInsumo req = abierto(20.0, AHORA.minusSeconds(1), AHORA.plusSeconds(100));
        when(solicitarInsumo.ventanaMs()).thenReturn(VENTANA_MS);
        when(requerimientoRepository.buscarEscalables(AHORA)).thenReturn(List.of(req));
        when(requerimientoRepository.escalarSiAbierto(req.getId(), 25.0, AHORA.plusSeconds(100))).thenReturn(1);

        useCase.ejecutar();

        assertThat(req.getRadioKm()).isEqualTo(25.0);
        assertThat(req.getVentanaExpiraEn()).isEqualTo(AHORA.plusSeconds(100));
    }

    @Test
    void theRadiusIsCappedAtTheMaximum() {
        RequerimientoInsumo req = abierto(22.0, AHORA.minusSeconds(1), AHORA.plusSeconds(600));
        when(solicitarInsumo.ventanaMs()).thenReturn(VENTANA_MS);
        when(requerimientoRepository.buscarEscalables(AHORA)).thenReturn(List.of(req));
        when(requerimientoRepository.escalarSiAbierto(req.getId(), 25.0, AHORA.plusMillis(VENTANA_MS)))
                .thenReturn(1);

        useCase.ejecutar();

        assertThat(req.getRadioKm()).isEqualTo(25.0);
        verify(solicitarInsumo).ofrecer(req, 25.0, AHORA);
    }

    @Test
    void doesNothingWhenNothingIsDue() {
        when(requerimientoRepository.buscarEscalables(AHORA)).thenReturn(List.of());

        assertThat(useCase.ejecutar()).isZero();

        verify(requerimientoRepository, never()).save(any());
        verify(solicitarInsumo, never()).ofrecer(any(), anyDouble(), any());
    }

    @Test
    void doesNotWidenBeyondTheMaximumRadius() {
        RequerimientoInsumo req = abierto(25.0, AHORA.minusSeconds(1), AHORA.plusSeconds(600));
        when(requerimientoRepository.buscarEscalables(AHORA)).thenReturn(List.of(req));

        assertThat(useCase.ejecutar()).isZero();

        assertThat(req.getRadioKm()).isEqualTo(25.0);
        verify(requerimientoRepository, never()).save(any());
        verify(solicitarInsumo, never()).ofrecer(any(), anyDouble(), any());
    }

    @Test
    void ignoresALegacyRequestWithoutRadius() {
        RequerimientoInsumo legado = RequerimientoInsumo.crear(UUID.randomUUID(), UUID.randomUUID(),
                List.of(new InsumoLinea("Filtro", 1)), null, AHORA.minusSeconds(100), AHORA.plusSeconds(600));
        when(requerimientoRepository.buscarEscalables(AHORA)).thenReturn(List.of(legado));

        assertThat(useCase.ejecutar()).isZero();

        verify(requerimientoRepository, never()).save(any());
        verify(solicitarInsumo, never()).ofrecer(any(), anyDouble(), any());
    }

    @Test
    void aRequestAcceptedWhileTheSweepWasReadingIsLeftUntouchedAndTheBatchContinues() {
        RequerimientoInsumo aceptada = abierto(10.0, AHORA.minusSeconds(1), AHORA.plusSeconds(600));
        RequerimientoInsumo sano = abierto(10.0, AHORA.minusSeconds(1), AHORA.plusSeconds(600));
        when(solicitarInsumo.ventanaMs()).thenReturn(VENTANA_MS);
        when(requerimientoRepository.buscarEscalables(AHORA)).thenReturn(List.of(aceptada, sano));
        when(requerimientoRepository.escalarSiAbierto(aceptada.getId(), 15.0, AHORA.plusMillis(VENTANA_MS)))
                .thenReturn(0);
        when(requerimientoRepository.escalarSiAbierto(sano.getId(), 15.0, AHORA.plusMillis(VENTANA_MS)))
                .thenReturn(1);

        assertThat(useCase.ejecutar()).isEqualTo(1);

        // The accepted request is never saved over and no new ring is offered for it.
        verify(requerimientoRepository, never()).save(any());
        verify(solicitarInsumo).ofrecer(sano, 15.0, AHORA);
        verify(solicitarInsumo, never()).ofrecer(aceptada, 15.0, AHORA);
    }

    private RequerimientoInsumo abierto(double radioKm, Instant ventanaExpiraEn, Instant expiraEn) {
        return RequerimientoInsumo.crear(UUID.randomUUID(), UUID.randomUUID(),
                List.of(new InsumoLinea("Filtro secadora", 2)), null, AHORA.minusSeconds(300), expiraEn, DESTINO,
                radioKm, ventanaExpiraEn);
    }
}
