package com.sena.cold_day.core.modules.proveedores.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;

/**
 * The technician is warned once when the ETA a supplier committed to elapses
 * without a dispatch. No sanction: the request keeps its state. The warning is
 * recorded before it is sent so a failing push cannot make it repeat.
 */
@ExtendWith(MockitoExtension.class)
class AvisarEtaVencidoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");

    @Mock RequerimientoInsumoRepository requerimientoRepository;
    @Mock NotificacionInsumoPort notificacion;

    private AvisarEtaVencidoUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new AvisarEtaVencidoUseCase(requerimientoRepository, notificacion,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    private RequerimientoInsumo asignado() {
        RequerimientoInsumo req = RequerimientoInsumo.crear(UUID.randomUUID(), UUID.randomUUID(),
                List.of(new InsumoLinea("Filtro", 1)), null, AHORA.minusSeconds(4000), AHORA.plusSeconds(100));
        req.asignar(30, 5.0, AHORA.minusSeconds(3600));
        return req;
    }

    @Test
    void recordsTheWarningThenNotifiesTheTechnicianAndKeepsTheState() {
        RequerimientoInsumo req = asignado();
        when(requerimientoRepository.buscarEtaVencidos(AHORA)).thenReturn(List.of(req));
        when(requerimientoRepository.marcarEtaAvisado(req.getId(), AHORA)).thenReturn(1);

        int avisados = useCase.ejecutar();

        assertThat(avisados).isEqualTo(1);
        assertThat(req.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
        InOrder orden = inOrder(requerimientoRepository, notificacion);
        orden.verify(requerimientoRepository).marcarEtaAvisado(req.getId(), AHORA);
        orden.verify(notificacion).notificarEtaVencido(req);
        verify(requerimientoRepository, never()).save(any());
    }

    @Test
    void doesNothingWhenNoEtaElapsed() {
        when(requerimientoRepository.buscarEtaVencidos(AHORA)).thenReturn(List.of());

        assertThat(useCase.ejecutar()).isZero();

        verify(requerimientoRepository, never()).marcarEtaAvisado(any(), any());
        verify(notificacion, never()).notificarEtaVencido(any());
    }

    @Test
    void aFailingNotifierNeverBreaksTheSweepNorUndoesTheClaim() {
        RequerimientoInsumo req = asignado();
        when(requerimientoRepository.buscarEtaVencidos(AHORA)).thenReturn(List.of(req));
        when(requerimientoRepository.marcarEtaAvisado(req.getId(), AHORA)).thenReturn(1);
        doThrow(new IllegalStateException("push caido")).when(notificacion).notificarEtaVencido(req);

        assertThat(useCase.ejecutar()).isEqualTo(1);

        verify(requerimientoRepository).marcarEtaAvisado(req.getId(), AHORA);
    }

    @Test
    void aRequestDispatchedOrAlreadyWarnedWhileTheSweepWasReadingIsNotNotifiedAndTheBatchContinues() {
        RequerimientoInsumo yaDespachado = asignado();
        RequerimientoInsumo sano = asignado();
        when(requerimientoRepository.buscarEtaVencidos(AHORA)).thenReturn(List.of(yaDespachado, sano));
        when(requerimientoRepository.marcarEtaAvisado(yaDespachado.getId(), AHORA)).thenReturn(0);
        when(requerimientoRepository.marcarEtaAvisado(sano.getId(), AHORA)).thenReturn(1);

        assertThat(useCase.ejecutar()).isEqualTo(1);

        verify(notificacion, never()).notificarEtaVencido(yaDespachado);
        verify(notificacion).notificarEtaVencido(sano);
    }
}
