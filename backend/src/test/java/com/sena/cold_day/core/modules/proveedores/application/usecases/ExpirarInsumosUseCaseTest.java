package com.sena.cold_day.core.modules.proveedores.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;

/**
 * Server-authoritative expiry sweep (spec disp.R4, design AD6): pending offers
 * past their window close and open requests past their window resolve, both with
 * one injected clock and without touching the OT lifecycle.
 */
@ExtendWith(MockitoExtension.class)
class ExpirarInsumosUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");

    @Mock OfertaInsumoRepository ofertaRepository;
    @Mock RequerimientoInsumoRepository requerimientoRepository;

    private ExpirarInsumosUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new ExpirarInsumosUseCase(ofertaRepository, requerimientoRepository,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void expiresPendingOffersAndResolvesOpenRequests() {
        when(ofertaRepository.expirarVencidas(AHORA)).thenReturn(2);
        when(requerimientoRepository.expirarVencidos(AHORA)).thenReturn(1);

        ExpirarInsumosUseCase.Resultado resultado = useCase.expirar();

        assertThat(resultado.ofertasExpiradas()).isEqualTo(2);
        assertThat(resultado.requerimientosSinProveedor()).isEqualTo(1);
        verify(ofertaRepository).expirarVencidas(AHORA);
        verify(requerimientoRepository).expirarVencidos(AHORA);
    }

    @Test
    void reportsZeroWhenNothingIsExpired() {
        when(ofertaRepository.expirarVencidas(AHORA)).thenReturn(0);
        when(requerimientoRepository.expirarVencidos(AHORA)).thenReturn(0);

        ExpirarInsumosUseCase.Resultado resultado = useCase.expirar();

        assertThat(resultado.ofertasExpiradas()).isZero();
        assertThat(resultado.requerimientosSinProveedor()).isZero();
    }
}
