package com.sena.cold_day.core.modules.proveedores.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.IncumplimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.CambioProveedorNoPermitidoException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.RequerimientoInsumoNoEncontradoException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.IncumplimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/** Cambio de proveedor cuando vence el ETA (diseno 2026-11-26). */
@ExtendWith(MockitoExtension.class)
class CambiarProveedorInsumoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant ACEPTADA_EN = AHORA.minusSeconds(38 * 60);
    private static final UUID TECNICO_ID = UUID.randomUUID();

    @Mock RequerimientoInsumoRepository requerimientoRepository;
    @Mock OfertaInsumoRepository ofertaRepository;
    @Mock IncumplimientoInsumoRepository incumplimientoRepository;
    @Mock SolicitarInsumoUseCase solicitarInsumo;
    @Mock NotificacionInsumoPort notificacion;

    private CambiarProveedorInsumoUseCase useCase;
    private final RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
    private final ProveedorId proveedorId = ProveedorId.desde(UUID.randomUUID());

    @BeforeEach
    void setUp() {
        useCase = new CambiarProveedorInsumoUseCase(requerimientoRepository, ofertaRepository,
                incumplimientoRepository, solicitarInsumo, notificacion, Clock.fixed(AHORA, ZoneOffset.UTC),
                900_000L, 10.0);
    }

    @Test
    void reabreReemplazaRegistraYVuelveAOfrecer() {
        RequerimientoInsumo asignado = requerimiento(EstadoRequerimiento.ASIGNADO);
        RequerimientoInsumo reabierto = requerimiento(EstadoRequerimiento.SOLICITADO);
        when(requerimientoRepository.buscarPorId(id)).thenReturn(Optional.of(asignado), Optional.of(reabierto));
        when(ofertaRepository.buscarAceptada(id)).thenReturn(Optional.of(ofertaAceptada()));
        when(solicitarInsumo.ventanaMs()).thenReturn(225_000L);
        when(requerimientoRepository.reabrirSiEtaVencido(id, TECNICO_ID, AHORA, AHORA.plusSeconds(900), 10.0,
                AHORA.plusSeconds(225))).thenReturn(1);

        RequerimientoInsumo resultado = useCase.cambiar(id, TECNICO_ID);

        assertThat(resultado).isSameAs(reabierto);
        ArgumentCaptor<IncumplimientoInsumo> registro = ArgumentCaptor.forClass(IncumplimientoInsumo.class);
        InOrder orden = inOrder(requerimientoRepository, ofertaRepository, incumplimientoRepository,
                solicitarInsumo, notificacion);
        orden.verify(requerimientoRepository).reabrirSiEtaVencido(id, TECNICO_ID, AHORA, AHORA.plusSeconds(900),
                10.0, AHORA.plusSeconds(225));
        orden.verify(ofertaRepository).reemplazarAceptada(id, proveedorId, AHORA);
        orden.verify(incumplimientoRepository).guardar(registro.capture());
        orden.verify(solicitarInsumo).ofrecer(reabierto, 10.0, AHORA);
        orden.verify(notificacion).notificarReemplazado(proveedorId, reabierto);
        assertThat(registro.getValue().proveedorId()).isEqualTo(proveedorId);
        assertThat(registro.getValue().etaMinutos()).isEqualTo(30);
        assertThat(registro.getValue().aceptadaEn()).isEqualTo(ACEPTADA_EN);
        assertThat(registro.getValue().reemplazadoEn()).isEqualTo(AHORA);
    }

    @Test
    void siNoCambiaFilasNoRegistraNiOfrece() {
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(EstadoRequerimiento.ASIGNADO)));
        when(ofertaRepository.buscarAceptada(id)).thenReturn(Optional.of(ofertaAceptada()));

        assertThatThrownBy(() -> useCase.cambiar(id, TECNICO_ID))
                .isInstanceOf(CambioProveedorNoPermitidoException.class)
                .hasMessage("Todavía no vence el tiempo prometido");

        verify(incumplimientoRepository, never()).guardar(any());
        verify(solicitarInsumo, never()).ofrecer(any(), org.mockito.ArgumentMatchers.anyDouble(), any());
    }

    @Test
    void unPedidoDespachadoNoSePuedeQuitar() {
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(EstadoRequerimiento.DESPACHADO)));
        when(ofertaRepository.buscarAceptada(id)).thenReturn(Optional.of(ofertaAceptada()));

        assertThatThrownBy(() -> useCase.cambiar(id, TECNICO_ID))
                .isInstanceOf(CambioProveedorNoPermitidoException.class)
                .hasMessage("El proveedor ya despachó el pedido");
    }

    @Test
    void elSegundoToqueEncuentraElPedidoSinGanadorYNoHaceNada() {
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(EstadoRequerimiento.SOLICITADO)));
        when(ofertaRepository.buscarAceptada(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.cambiar(id, TECNICO_ID))
                .isInstanceOf(CambioProveedorNoPermitidoException.class);

        verify(incumplimientoRepository, never()).guardar(any());
    }

    @Test
    void otroTecnicoRecibeNoEncontrado() {
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(EstadoRequerimiento.ASIGNADO)));

        assertThatThrownBy(() -> useCase.cambiar(id, UUID.randomUUID()))
                .isInstanceOf(RequerimientoInsumoNoEncontradoException.class);

        verify(requerimientoRepository, never()).reabrirSiEtaVencido(any(), any(), any(), any(),
                org.mockito.ArgumentMatchers.anyDouble(), any());
    }

    @Test
    void unPushCaidoNoRevierteElCambio() {
        RequerimientoInsumo reabierto = requerimiento(EstadoRequerimiento.SOLICITADO);
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(EstadoRequerimiento.ASIGNADO)), Optional.of(reabierto));
        when(ofertaRepository.buscarAceptada(id)).thenReturn(Optional.of(ofertaAceptada()));
        when(requerimientoRepository.reabrirSiEtaVencido(any(), any(), any(), any(),
                org.mockito.ArgumentMatchers.anyDouble(), any())).thenReturn(1);
        doThrow(new IllegalStateException("push caido")).when(notificacion).notificarReemplazado(any(), any());

        // Sin nadie en el radio (ofrecer devuelve 0) el cambio tambien funciona.
        assertThat(useCase.cambiar(id, TECNICO_ID)).isSameAs(reabierto);
    }

    private RequerimientoInsumo requerimiento(EstadoRequerimiento estado) {
        boolean asignado = estado != EstadoRequerimiento.SOLICITADO;
        return RequerimientoInsumo.reconstituir(id, UUID.randomUUID(), TECNICO_ID, estado, null, null,
                AHORA.minusSeconds(3600), AHORA.minusSeconds(2700), null, null, 10.0, null,
                asignado ? 30 : null, asignado ? 5.0 : null, asignado ? ACEPTADA_EN : null, null, null);
    }

    private OfertaInsumo ofertaAceptada() {
        return OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), id, proveedorId, OfertaInsumoEstado.ACEPTADA,
                AHORA.minusSeconds(3600), AHORA, ACEPTADA_EN);
    }
}
