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
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.OfertaInsumoNoDisponibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Supplier rejection (spec disp.R5, design "State Machines"): the holder records
 * the {@code RECHAZADO} literal without being bound, and only the eligible
 * supplier that actually holds the offer may reject it.
 */
@ExtendWith(MockitoExtension.class)
class RechazarInsumoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(900);
    private static final long USUARIO_ID = 42L;

    @Mock OfertaInsumoRepository ofertaRepository;
    @Mock ProveedorRepository proveedorRepository;

    private RechazarInsumoUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new RechazarInsumoUseCase(ofertaRepository, proveedorRepository,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void recordsRechazadoWithoutBindingTheSupplier() {
        Proveedor proveedor = proveedorActivo();
        OfertaInsumo oferta = ofertaPendiente(proveedor.getId());
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(ofertaRepository.buscarPorId(oferta.getId())).thenReturn(Optional.of(oferta));
        when(ofertaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        OfertaInsumo resultado = useCase.rechazar(new UsuarioId(USUARIO_ID), oferta.getId());

        assertThat(resultado.getEstado()).isEqualTo(OfertaInsumoEstado.RECHAZADO);
        assertThat(resultado.getResueltaEn()).isEqualTo(AHORA);
        verify(ofertaRepository).save(oferta);
    }

    @Test
    void aSupplierCannotRejectAnOfferItDoesNotHold() {
        Proveedor proveedor = proveedorActivo();
        OfertaInsumo ajena = ofertaPendiente(ProveedorId.nueva());
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(ofertaRepository.buscarPorId(ajena.getId())).thenReturn(Optional.of(ajena));

        assertThatThrownBy(() -> useCase.rechazar(new UsuarioId(USUARIO_ID), ajena.getId()))
                .isInstanceOf(OfertaInsumoNoDisponibleException.class);

        verify(ofertaRepository, never()).save(any());
    }

    @Test
    void anIneligibleSupplierCannotReject() {
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.rechazar(new UsuarioId(USUARIO_ID), OfertaInsumoId.nueva()))
                .isInstanceOf(ProveedorNoElegibleException.class);

        verify(ofertaRepository, never()).save(any());
    }

    private Proveedor proveedorActivo() {
        return Proveedor.crear(USUARIO_ID, "Suministros del Norte", "900123456-1", "3105550001", null, null,
                Set.of());
    }

    private OfertaInsumo ofertaPendiente(ProveedorId proveedorId) {
        return OfertaInsumo.crear(RequerimientoInsumoId.nueva(), proveedorId, AHORA, EXPIRA);
    }
}
