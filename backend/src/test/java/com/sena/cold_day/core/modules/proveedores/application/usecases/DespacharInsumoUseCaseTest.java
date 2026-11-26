package com.sena.cold_day.core.modules.proveedores.application.usecases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
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
import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.PedidoReemplazadoException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoValidadoException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.TransicionRequerimientoInvalidaException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Dispatch step (design 2026-11-25): only the supplier that won the request can
 * move it {@code ASIGNADO -> DESPACHADO}; another supplier is ineligible, a
 * request in any other state fails the transition guard, and a supplier that
 * lost its documentary approval mid-flight cannot dispatch.
 */
@ExtendWith(MockitoExtension.class)
class DespacharInsumoUseCaseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(900);
    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();
    private static final long USUARIO_ID = 42L;

    @Mock RequerimientoInsumoRepository requerimientoRepository;
    @Mock OfertaInsumoRepository ofertaRepository;
    @Mock ProveedorRepository proveedorRepository;
    @Mock NotificacionInsumoPort notificacion;

    private DespacharInsumoUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new DespacharInsumoUseCase(requerimientoRepository, ofertaRepository, proveedorRepository,
                notificacion, Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void theWinningSupplierDispatchesTheAssignedRequest() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(id, EstadoRequerimiento.ASIGNADO)));
        when(ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA))
                .thenReturn(List.of(ofertaAceptada(id, proveedor.getId())));
        when(requerimientoRepository.despacharSiAsignado(id, proveedor.getId(), AHORA)).thenReturn(1);

        RequerimientoInsumo resultado = useCase.despachar(new UsuarioId(USUARIO_ID), id);

        assertThat(resultado.getEstado()).isEqualTo(EstadoRequerimiento.DESPACHADO);
        assertThat(resultado.getDespachadaEn()).isEqualTo(AHORA);
        verify(requerimientoRepository).despacharSiAsignado(id, proveedor.getId(), AHORA);
        verify(notificacion).notificarDespachada(resultado);
    }

    @Test
    void aFailingNotifierNeverChangesTheOutcomeOfTheDispatch() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(id, EstadoRequerimiento.ASIGNADO)));
        when(ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA))
                .thenReturn(List.of(ofertaAceptada(id, proveedor.getId())));
        when(requerimientoRepository.despacharSiAsignado(id, proveedor.getId(), AHORA)).thenReturn(1);
        org.mockito.Mockito.doThrow(new IllegalStateException("push caido")).when(notificacion).notificarDespachada(any());

        assertThat(useCase.despachar(new UsuarioId(USUARIO_ID), id).getEstado())
                .isEqualTo(EstadoRequerimiento.DESPACHADO);
    }

    @Test
    void aSupplierThatDidNotWinCannotDispatch() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(id, EstadoRequerimiento.ASIGNADO)));
        when(ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA))
                .thenReturn(List.of());

        assertThatThrownBy(() -> useCase.despachar(new UsuarioId(USUARIO_ID), id))
                .isInstanceOf(ProveedorNoElegibleException.class);

        verify(requerimientoRepository, never()).despacharSiAsignado(any(), any(), any());
    }

    @Test
    void dispatchingTwiceIsAConflict() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(id, EstadoRequerimiento.DESPACHADO)));
        when(ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA))
                .thenReturn(List.of(ofertaAceptada(id, proveedor.getId())));

        assertThatThrownBy(() -> useCase.despachar(new UsuarioId(USUARIO_ID), id))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);

        verify(requerimientoRepository, never()).despacharSiAsignado(any(), any(), any());
    }

    @Test
    void aSupplierThatLostItsApprovalCannotDispatch() {
        Proveedor sinAprobar = Proveedor.crear(USUARIO_ID, "Suministros", "900-9", null, null, null, Set.of());
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(sinAprobar));

        assertThatThrownBy(() -> useCase.despachar(new UsuarioId(USUARIO_ID), RequerimientoInsumoId.nueva()))
                .isInstanceOf(ProveedorNoValidadoException.class);

        verify(requerimientoRepository, never()).despacharSiAsignado(any(), any(), any());
    }

    @Test
    void elReemplazadoNoDespacha() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(id, EstadoRequerimiento.ASIGNADO)));
        when(ofertaRepository.fueReemplazado(id, proveedor.getId())).thenReturn(true);

        assertThatThrownBy(() -> useCase.despachar(new UsuarioId(USUARIO_ID), id))
                .isInstanceOf(PedidoReemplazadoException.class)
                .hasMessage("Este pedido ya no es tuyo");

        verify(requerimientoRepository, never()).despacharSiAsignado(any(), any(), any());
    }

    @Test
    void siElPedidoCambioEntreLeerYEscribirDaConflicto() {
        Proveedor proveedor = proveedorActivo();
        RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
        when(proveedorRepository.findByUsuarioId(USUARIO_ID)).thenReturn(Optional.of(proveedor));
        when(requerimientoRepository.buscarPorId(id))
                .thenReturn(Optional.of(requerimiento(id, EstadoRequerimiento.ASIGNADO)));
        when(ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA))
                .thenReturn(List.of(ofertaAceptada(id, proveedor.getId())));
        when(ofertaRepository.fueReemplazado(id, proveedor.getId())).thenReturn(false, true);

        assertThatThrownBy(() -> useCase.despachar(new UsuarioId(USUARIO_ID), id))
                .isInstanceOf(PedidoReemplazadoException.class);

        verify(notificacion, never()).notificarDespachada(any());
    }

    private Proveedor proveedorActivo() {
        Proveedor proveedor = Proveedor.crear(USUARIO_ID, "Suministros del Norte", "900123456-1", "3105550001",
                null, null, Set.of());
        proveedor.aprobarValidacion(LocalDate.of(2026, 1, 1),
                List.of(new DocumentoProveedor(1L, proveedor.getId(), "RUT", LocalDate.of(2027, 1, 1))));
        return proveedor;
    }

    private RequerimientoInsumo requerimiento(RequerimientoInsumoId id, EstadoRequerimiento estado) {
        return RequerimientoInsumo.reconstituir(id, OT_ID, TECNICO_ID, estado, null, null, AHORA, EXPIRA, null);
    }

    private OfertaInsumo ofertaAceptada(RequerimientoInsumoId requerimientoId, ProveedorId proveedorId) {
        return OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), requerimientoId, proveedorId,
                OfertaInsumoEstado.ACEPTADA, AHORA, EXPIRA, AHORA);
    }
}
