package com.sena.cold_day.core.modules.proveedores.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.OfertaInsumoNoDisponibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Atomic first-to-accept (spec disp.R3, design AD6/AD7): the winner assigns the
 * request and cancels every sibling; a loser mutates nothing; an ineligible or
 * inactive supplier cannot accept (403, never 500); foreign and expired offers
 * are unavailable.
 */
@ExtendWith(MockitoExtension.class)
class AceptarInsumoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(900);
    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();
    private static final long USUARIO_ID = 42L;

    @Mock RequerimientoInsumoRepository requerimientoRepository;
    @Mock OfertaInsumoRepository ofertaRepository;
    @Mock ProveedorRepository proveedorRepository;

    private AceptarInsumoUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new AceptarInsumoUseCase(requerimientoRepository, ofertaRepository, proveedorRepository,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void theWinnerAssignsTheRequestAndInvalidatesEverySibling() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumo solicitado = requerimientoSolicitado();
        OfertaInsumo oferta = OfertaInsumo.crear(solicitado.getId(), proveedor.getId(), AHORA, EXPIRA);
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(ofertaRepository.buscarPorId(oferta.getId())).thenReturn(Optional.of(oferta));
        when(requerimientoRepository.buscarPorId(solicitado.getId()))
                .thenReturn(Optional.of(solicitado))
                .thenReturn(Optional.of(requerimientoAsignado(solicitado.getId())));
        when(requerimientoRepository.intentarAsignar(solicitado.getId(), AHORA)).thenReturn(1);
        when(ofertaRepository.intentarAceptar(oferta.getId(), AHORA)).thenReturn(1);

        RequerimientoInsumo resultado = useCase.aceptar(new UsuarioId(USUARIO_ID), oferta.getId());

        assertThat(resultado.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
        verify(requerimientoRepository).intentarAsignar(solicitado.getId(), AHORA);
        verify(ofertaRepository).intentarAceptar(oferta.getId(), AHORA);
        verify(ofertaRepository).invalidarPendientesDe(solicitado.getId(), OfertaInsumoEstado.CANCELADA, AHORA);
    }

    @Test
    void aLosingAcceptanceMutatesNothing() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumo solicitado = requerimientoSolicitado();
        OfertaInsumo oferta = OfertaInsumo.crear(solicitado.getId(), proveedor.getId(), AHORA, EXPIRA);
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(ofertaRepository.buscarPorId(oferta.getId())).thenReturn(Optional.of(oferta));
        when(requerimientoRepository.buscarPorId(solicitado.getId())).thenReturn(Optional.of(solicitado));
        when(requerimientoRepository.intentarAsignar(solicitado.getId(), AHORA)).thenReturn(0);

        assertThatThrownBy(() -> useCase.aceptar(new UsuarioId(USUARIO_ID), oferta.getId()))
                .isInstanceOf(OfertaInsumoNoDisponibleException.class);

        verify(ofertaRepository, never()).intentarAceptar(any(), any());
        verify(ofertaRepository, never()).invalidarPendientesDe(any(), any(), any());
        verify(ofertaRepository, never()).save(any());
    }

    @Test
    void anUnknownSupplierCannotAccept() {
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.aceptar(new UsuarioId(USUARIO_ID), OfertaInsumoId.nueva()))
                .isInstanceOf(ProveedorNoElegibleException.class);

        verify(ofertaRepository, never()).buscarPorId(any());
    }

    @Test
    void anInactiveSupplierCannotAccept() {
        Proveedor inactivo = proveedorActivo();
        inactivo.desactivar();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(inactivo));

        assertThatThrownBy(() -> useCase.aceptar(new UsuarioId(USUARIO_ID), OfertaInsumoId.nueva()))
                .isInstanceOf(ProveedorNoElegibleException.class);

        verify(ofertaRepository, never()).buscarPorId(any());
    }

    @Test
    void anExpiredOfferIsRejectedLazilyWithoutWinningTheGate() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumo solicitado = requerimientoSolicitado();
        OfertaInsumo expirada = OfertaInsumo.crear(solicitado.getId(), proveedor.getId(), AHORA.minusSeconds(120),
                AHORA.minusSeconds(60));
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(ofertaRepository.buscarPorId(expirada.getId())).thenReturn(Optional.of(expirada));

        assertThatThrownBy(() -> useCase.aceptar(new UsuarioId(USUARIO_ID), expirada.getId()))
                .isInstanceOf(OfertaInsumoNoDisponibleException.class);

        verify(requerimientoRepository, never()).intentarAsignar(any(), any());
    }

    @Test
    void anExpiredRequestIsUnavailable() {
        Proveedor proveedor = proveedorActivo();
        OfertaInsumo oferta = OfertaInsumo.crear(RequerimientoInsumoId.nueva(), proveedor.getId(), AHORA, EXPIRA);
        RequerimientoInsumo vencido = RequerimientoInsumo.reconstituir(oferta.getRequerimientoId(), OT_ID,
                TECNICO_ID, EstadoRequerimiento.SOLICITADO, null, null, AHORA.minusSeconds(120),
                AHORA.minusSeconds(60), null);
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(ofertaRepository.buscarPorId(oferta.getId())).thenReturn(Optional.of(oferta));
        when(requerimientoRepository.buscarPorId(oferta.getRequerimientoId())).thenReturn(Optional.of(vencido));

        assertThatThrownBy(() -> useCase.aceptar(new UsuarioId(USUARIO_ID), oferta.getId()))
                .isInstanceOf(OfertaInsumoNoDisponibleException.class);

        verify(requerimientoRepository, never()).intentarAsignar(any(), any());
    }

    @Test
    void anOfferOfAnotherSupplierIsUnavailable() {
        Proveedor proveedor = proveedorActivo();
        OfertaInsumo ajena = OfertaInsumo.crear(RequerimientoInsumoId.nueva(), ProveedorId.nueva(), AHORA, EXPIRA);
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(ofertaRepository.buscarPorId(ajena.getId())).thenReturn(Optional.of(ajena));

        assertThatThrownBy(() -> useCase.aceptar(new UsuarioId(USUARIO_ID), ajena.getId()))
                .isInstanceOf(OfertaInsumoNoDisponibleException.class);

        verify(requerimientoRepository, never()).intentarAsignar(any(), any());
    }

    private Proveedor proveedorActivo() {
        return Proveedor.crear(USUARIO_ID, "Suministros del Norte", "900123456-1", "3105550001", null, null,
                Set.of());
    }

    private RequerimientoInsumo requerimientoSolicitado() {
        return RequerimientoInsumo.crear(OT_ID, TECNICO_ID, List.of(new InsumoLinea("Filtro secadora", 2)), null,
                AHORA, EXPIRA);
    }

    private RequerimientoInsumo requerimientoAsignado(RequerimientoInsumoId id) {
        return RequerimientoInsumo.reconstituir(id, OT_ID, TECNICO_ID, EstadoRequerimiento.ASIGNADO, null, null,
                AHORA, EXPIRA, AHORA);
    }
}
