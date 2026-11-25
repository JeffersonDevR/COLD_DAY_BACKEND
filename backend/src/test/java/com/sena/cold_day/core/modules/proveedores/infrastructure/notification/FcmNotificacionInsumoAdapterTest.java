package com.sena.cold_day.core.modules.proveedores.infrastructure.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.sena.cold_day.core.modules.ot.infrastructure.notification.CanalPush;
import com.sena.cold_day.core.modules.ot.infrastructure.notification.FcmSender;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.DispositivoPush;
import com.sena.cold_day.core.modules.usuarios.domain.repository.DispositivoPushRepository;

/** Push of the insumo dispatch: it never breaks the dispatch and carries no personal data. */
class FcmNotificacionInsumoAdapterTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");

    private final FcmSender sender = mock(FcmSender.class);
    private final DispositivoPushRepository dispositivos = mock(DispositivoPushRepository.class);
    private final ProveedorRepository proveedores = mock(ProveedorRepository.class);
    private final TecnicoRepository tecnicos = mock(TecnicoRepository.class);
    private final FcmNotificacionInsumoAdapter adapter =
            new FcmNotificacionInsumoAdapter(sender, dispositivos, proveedores, tecnicos);

    private final ProveedorId proveedorId = ProveedorId.nueva();
    private final UUID otId = UUID.randomUUID();
    private final UUID tecnicoUuid = UUID.randomUUID();

    private RequerimientoInsumo requerimiento() {
        return RequerimientoInsumo.crear(otId, tecnicoUuid,
                List.of(new InsumoLinea("Filtro secadora", 2), new InsumoLinea("Capacitor", 1)), null, AHORA,
                AHORA.plusSeconds(900));
    }

    private void proveedorConDispositivos(Long usuarioId, String... tokens) {
        Proveedor proveedor = mock(Proveedor.class);
        when(proveedor.getUsuarioId()).thenReturn(usuarioId);
        when(proveedores.buscarPorId(proveedorId)).thenReturn(Optional.of(proveedor));
        when(dispositivos.listarPorUsuario(usuarioId, FcmNotificacionInsumoAdapter.MAX_DISPOSITIVOS))
                .thenReturn(java.util.Arrays.stream(tokens)
                        .map(token -> new DispositivoPush(1L, usuarioId, token, "ANDROID", AHORA, AHORA)).toList());
    }

    private void tecnicoConDispositivos(Long usuarioId, String... tokens) {
        Tecnico tecnico = mock(Tecnico.class);
        when(tecnico.getUsuarioId()).thenReturn(usuarioId);
        when(tecnicos.findByIdAndActivoTrue(new TecnicoId(tecnicoUuid))).thenReturn(Optional.of(tecnico));
        when(dispositivos.listarPorUsuario(usuarioId, FcmNotificacionInsumoAdapter.MAX_DISPOSITIVOS))
                .thenReturn(java.util.Arrays.stream(tokens)
                        .map(token -> new DispositivoPush(1L, usuarioId, token, "ANDROID", AHORA, AHORA)).toList());
    }

    @Test
    void theNewRequestReachesEveryDeviceOfTheSupplierOnItsOwnChannelWithoutPersonalData() {
        RequerimientoInsumo requerimiento = requerimiento();
        OfertaInsumo oferta = OfertaInsumo.crear(requerimiento.getId(), proveedorId, AHORA, AHORA.plusSeconds(900),
                7.5, 15);
        proveedorConDispositivos(9L, "tok-a", "tok-b");

        adapter.notificarSolicitud(proveedorId, oferta, requerimiento);

        ArgumentCaptor<String> cuerpo = ArgumentCaptor.forClass(String.class);
        verify(sender).enviar(eq("tok-a"), eq(CanalPush.INSUMO_NUEVO_PROV), eq("Nueva solicitud de repuestos"),
                cuerpo.capture(), eq(Map.of("ruta", "/proveedor/insumos", "requerimientoId",
                        requerimiento.getId().valor().toString())), any());
        verify(sender).enviar(eq("tok-b"), eq(CanalPush.INSUMO_NUEVO_PROV), anyString(), anyString(), any(), any());
        // 3 pieces in total and the distance, nothing that identifies the technician or the address.
        org.assertj.core.api.Assertions.assertThat(cuerpo.getValue()).contains("3 repuestos").contains("7.5 km");
    }

    @Test
    void acceptanceTellsTheTechnicianTheCommittedEta() {
        RequerimientoInsumo requerimiento = requerimiento();
        requerimiento.asignar(35, 7.5, AHORA);
        tecnicoConDispositivos(7L, "tok-tec");

        adapter.notificarAceptada(requerimiento);

        ArgumentCaptor<String> cuerpo = ArgumentCaptor.forClass(String.class);
        verify(sender).enviar(eq("tok-tec"), eq(CanalPush.OT_UPDATE_TEC), eq("Tus repuestos tienen proveedor"),
                cuerpo.capture(), eq(Map.of("ruta", "/tecnico/ejecucion/" + otId, "otId", otId.toString())), any());
        org.assertj.core.api.Assertions.assertThat(cuerpo.getValue()).contains("35 min");
    }

    @Test
    void dispatchDeliveryAndElapsedEtaAlsoGoToTheTechnician() {
        RequerimientoInsumo requerimiento = requerimiento();
        tecnicoConDispositivos(7L, "tok-tec");

        adapter.notificarDespachada(requerimiento);
        adapter.notificarEntregada(requerimiento);
        adapter.notificarEtaVencido(requerimiento);

        verify(sender).enviar(eq("tok-tec"), eq(CanalPush.OT_UPDATE_TEC), eq("Tus repuestos van en camino"),
                anyString(), any(), any());
        verify(sender).enviar(eq("tok-tec"), eq(CanalPush.OT_UPDATE_TEC), eq("Repuestos entregados"),
                anyString(), any(), any());
        verify(sender).enviar(eq("tok-tec"), eq(CanalPush.OT_UPDATE_TEC), eq("Tus repuestos se están demorando"),
                anyString(), any(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void anInvalidTokenIsRemovedFromTheUser() {
        RequerimientoInsumo requerimiento = requerimiento();
        OfertaInsumo oferta = OfertaInsumo.crear(requerimiento.getId(), proveedorId, AHORA, AHORA.plusSeconds(900));
        proveedorConDispositivos(9L, "tok-muerto");

        adapter.notificarSolicitud(proveedorId, oferta, requerimiento);

        ArgumentCaptor<Consumer<String>> invalido = ArgumentCaptor.forClass(Consumer.class);
        verify(sender).enviar(eq("tok-muerto"), any(CanalPush.class), anyString(), anyString(), any(),
                invalido.capture());
        invalido.getValue().accept("tok-muerto");
        verify(dispositivos).eliminar(9L, "tok-muerto");
    }

    @Test
    void aSupplierWithoutDevicesGetsNothing() {
        RequerimientoInsumo requerimiento = requerimiento();
        OfertaInsumo oferta = OfertaInsumo.crear(requerimiento.getId(), proveedorId, AHORA, AHORA.plusSeconds(900));
        proveedorConDispositivos(9L);

        adapter.notificarSolicitud(proveedorId, oferta, requerimiento);

        verify(sender, never()).enviar(anyString(), any(CanalPush.class), anyString(), anyString(), any(), any());
    }

    @Test
    void aFailingSenderOrRepositoryNeverBreaksTheDispatch() {
        RequerimientoInsumo requerimiento = requerimiento();
        OfertaInsumo oferta = OfertaInsumo.crear(requerimiento.getId(), proveedorId, AHORA, AHORA.plusSeconds(900));
        proveedorConDispositivos(9L, "tok-a");
        doThrow(new IllegalStateException("fcm caido")).when(sender)
                .enviar(anyString(), any(CanalPush.class), anyString(), anyString(), any(), any());

        adapter.notificarSolicitud(proveedorId, oferta, requerimiento);

        when(tecnicos.findByIdAndActivoTrue(any())).thenThrow(new IllegalStateException("bd caida"));
        adapter.notificarAceptada(requerimiento);
        adapter.notificarDespachada(requerimiento);
        adapter.notificarEntregada(requerimiento);
        adapter.notificarEtaVencido(requerimiento);
    }
}
