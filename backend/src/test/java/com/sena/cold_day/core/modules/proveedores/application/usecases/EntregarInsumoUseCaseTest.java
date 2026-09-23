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
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.TransicionRequerimientoInvalidaException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Delivery confirmation (spec disp.R7, design AD8): only the winning supplier —
 * the one whose offer is {@code ACEPTADA} for the request — can move
 * {@code ASIGNADO -> ENTREGADO}; another supplier is ineligible and an
 * already-delivered request fails the transition guard.
 */
@ExtendWith(MockitoExtension.class)
class EntregarInsumoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(900);
    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();
    private static final long USUARIO_ID = 42L;

    @Mock RequerimientoInsumoRepository requerimientoRepository;
    @Mock OfertaInsumoRepository ofertaRepository;
    @Mock ProveedorRepository proveedorRepository;

    private EntregarInsumoUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new EntregarInsumoUseCase(requerimientoRepository, ofertaRepository, proveedorRepository,
                Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void theAssignedSupplierMarksTheRequestEntregado() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId requerimientoId = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(requerimientoId))
                .thenReturn(Optional.of(requerimiento(requerimientoId, EstadoRequerimiento.ASIGNADO, null)));
        when(ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA))
                .thenReturn(List.of(ofertaAceptada(requerimientoId, proveedor.getId())));
        when(requerimientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RequerimientoInsumo resultado = useCase.entregar(new UsuarioId(USUARIO_ID), requerimientoId);

        assertThat(resultado.getEstado()).isEqualTo(EstadoRequerimiento.ENTREGADO);
        assertThat(resultado.getResueltaEn()).isEqualTo(AHORA);
        verify(requerimientoRepository).save(any());
    }

    @Test
    void aDifferentSupplierCannotConfirmDelivery() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId requerimientoId = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(requerimientoId))
                .thenReturn(Optional.of(requerimiento(requerimientoId, EstadoRequerimiento.ASIGNADO, null)));
        when(ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA))
                .thenReturn(List.of());

        assertThatThrownBy(() -> useCase.entregar(new UsuarioId(USUARIO_ID), requerimientoId))
                .isInstanceOf(ProveedorNoElegibleException.class);

        verify(requerimientoRepository, never()).save(any());
    }

    @Test
    void anAlreadyDeliveredRequestCannotBeDeliveredAgain() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId requerimientoId = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(requerimientoId))
                .thenReturn(Optional.of(requerimiento(requerimientoId, EstadoRequerimiento.ENTREGADO, AHORA)));
        when(ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA))
                .thenReturn(List.of(ofertaAceptada(requerimientoId, proveedor.getId())));

        assertThatThrownBy(() -> useCase.entregar(new UsuarioId(USUARIO_ID), requerimientoId))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);

        verify(requerimientoRepository, never()).save(any());
    }

    private Proveedor proveedorActivo() {
        return Proveedor.crear(USUARIO_ID, "Suministros del Norte", "900123456-1", "3105550001", null, null,
                Set.of());
    }

    private RequerimientoInsumo requerimiento(RequerimientoInsumoId id, EstadoRequerimiento estado,
            Instant resueltaEn) {
        return RequerimientoInsumo.reconstituir(id, OT_ID, TECNICO_ID, estado, null, null, AHORA, EXPIRA,
                resueltaEn);
    }

    private OfertaInsumo ofertaAceptada(RequerimientoInsumoId requerimientoId, ProveedorId proveedorId) {
        return OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), requerimientoId, proveedorId,
                OfertaInsumoEstado.ACEPTADA, AHORA, EXPIRA, AHORA);
    }
}
