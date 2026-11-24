package com.sena.cold_day.core.modules.ot.infrastructure.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.DispositivoPush;
import com.sena.cold_day.core.modules.usuarios.domain.repository.DispositivoPushRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** El push nunca rompe el despacho y el payload no lleva datos personales. */
class FcmNotificacionPushAdapterTest {

    private final FcmSender sender = mock(FcmSender.class);
    private final DispositivoPushRepository dispositivos = mock(DispositivoPushRepository.class);
    private final TecnicoRepository tecnicos = mock(TecnicoRepository.class);
    private final ClienteRepository clientes = mock(ClienteRepository.class);
    private final FcmNotificacionPushAdapter adapter =
            new FcmNotificacionPushAdapter(sender, dispositivos, tecnicos, clientes);

    private final TecnicoId tecnicoId = new TecnicoId(UUID.randomUUID());
    private final Ot ot = mock(Ot.class);

    @Test
    void notificaOfertaATodosLosDispositivosDelTecnico() {
        UUID otUuid = UUID.randomUUID();
        when(ot.getId()).thenReturn(new OtId(otUuid));
        Tecnico tecnico = mock(Tecnico.class);
        when(tecnico.getUsuarioId()).thenReturn(7L);
        when(tecnicos.findByIdAndActivoTrue(tecnicoId)).thenReturn(Optional.of(tecnico));
        Instant ahora = Instant.now();
        when(dispositivos.listarPorUsuario(7L, FcmNotificacionPushAdapter.MAX_DISPOSITIVOS)).thenReturn(List.of(
                new DispositivoPush(1L, 7L, "tok-a", "ANDROID", ahora, ahora),
                new DispositivoPush(2L, 7L, "tok-b", "ANDROID", ahora, ahora)));

        adapter.notificarOferta(tecnicoId, null, ot);

        verify(sender).enviar(eq("tok-a"), eq(CanalPush.OT_NUEVA_TEC), eq("Nueva oferta de servicio"), anyString(),
                eq(java.util.Map.of("ruta", "/tecnico/radar", "otId", otUuid.toString())), any());
        verify(sender).enviar(eq("tok-b"), any(CanalPush.class), anyString(), anyString(), any(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void tokenInvalidoSeBorraDelUsuario() {
        when(ot.getId()).thenReturn(new OtId(UUID.randomUUID()));
        Tecnico tecnico = mock(Tecnico.class);
        when(tecnico.getUsuarioId()).thenReturn(7L);
        when(tecnicos.findByIdAndActivoTrue(tecnicoId)).thenReturn(Optional.of(tecnico));
        Instant ahora = Instant.now();
        when(dispositivos.listarPorUsuario(7L, FcmNotificacionPushAdapter.MAX_DISPOSITIVOS))
                .thenReturn(List.of(new DispositivoPush(1L, 7L, "tok-muerto", "ANDROID", ahora, ahora)));

        adapter.notificarOferta(tecnicoId, null, ot);

        ArgumentCaptor<Consumer<String>> invalido = ArgumentCaptor.forClass(Consumer.class);
        verify(sender).enviar(eq("tok-muerto"), any(CanalPush.class), anyString(), anyString(), any(), invalido.capture());
        invalido.getValue().accept("tok-muerto");
        verify(dispositivos).eliminar(7L, "tok-muerto");
    }

    @Test
    void sinTecnicoNoEnviaNada() {
        when(tecnicos.findByIdAndActivoTrue(tecnicoId)).thenReturn(Optional.empty());

        adapter.notificarOferta(tecnicoId, null, ot);

        verify(sender, never()).enviar(anyString(), any(CanalPush.class), anyString(), anyString(), any(), any());
    }

    @Test
    void unFalloDelRepositorioNoRompeElDespacho() {
        when(ot.getId()).thenReturn(new OtId(UUID.randomUUID()));
        Tecnico tecnico = mock(Tecnico.class);
        when(tecnico.getUsuarioId()).thenReturn(7L);
        when(tecnicos.findByIdAndActivoTrue(tecnicoId)).thenReturn(Optional.of(tecnico));
        when(dispositivos.listarPorUsuario(7L, FcmNotificacionPushAdapter.MAX_DISPOSITIVOS))
                .thenThrow(new IllegalStateException("bd caida"));

        adapter.notificarOferta(tecnicoId, null, ot);

        verify(sender, never()).enviar(anyString(), any(CanalPush.class), anyString(), anyString(), any(), any());
    }

    @Test
    void notificarClienteUsaCanalDeActualizacionDelCliente() {
        UUID otUuid = UUID.randomUUID();
        when(ot.getId()).thenReturn(new OtId(otUuid));
        ClienteId clienteId = ClienteId.nueva();
        Cliente cliente = mock(Cliente.class);
        when(cliente.getUsuarioId()).thenReturn(new UsuarioId(9L));
        when(clientes.buscarPorId(clienteId)).thenReturn(Optional.of(cliente));
        Instant ahora = Instant.now();
        when(dispositivos.listarPorUsuario(9L, FcmNotificacionPushAdapter.MAX_DISPOSITIVOS))
                .thenReturn(List.of(new DispositivoPush(3L, 9L, "tok-cli", "ANDROID", ahora, ahora)));

        adapter.notificarCliente(clienteId, ot, "Sin tecnicos disponibles");

        verify(sender).enviar(eq("tok-cli"), eq(CanalPush.OT_UPDATE_CLI), anyString(),
                eq("Sin tecnicos disponibles"), any(), any());
    }

    @Test
    void presupuestoEnviadoVaAlClienteEnCanalNuevoSinDatosPersonales() {
        UUID otUuid = UUID.randomUUID();
        when(ot.getId()).thenReturn(new OtId(otUuid));
        ClienteId clienteId = ClienteId.nueva();
        clienteConDispositivo(clienteId, 9L, "tok-cli");

        adapter.notificarPresupuestoEnviado(clienteId, ot);

        verify(sender).enviar(eq("tok-cli"), eq(CanalPush.OT_NUEVA_CLI), eq("Presupuesto listo"),
                eq("El técnico envió el presupuesto de tu orden. Revísalo y apruébalo."),
                eq(Map.of("ruta", "/cliente/ot/" + otUuid + "/diagnostico", "otId", otUuid.toString())), any());
    }

    @Test
    void otAceptadaVaAlClienteEnCanalNuevoConLaCategoria() {
        UUID otUuid = UUID.randomUUID();
        when(ot.getId()).thenReturn(new OtId(otUuid));
        when(ot.getCategoriaServicio()).thenReturn(CategoriaServicio.AIRE_ACONDICIONADO);
        ClienteId clienteId = ClienteId.nueva();
        clienteConDispositivo(clienteId, 9L, "tok-cli");

        adapter.notificarOtAceptada(clienteId, ot);

        verify(sender).enviar(eq("tok-cli"), eq(CanalPush.OT_NUEVA_CLI), eq("Técnico asignado"),
                eq("Un técnico aceptó tu orden de aire acondicionado."),
                eq(Map.of("ruta", "/cliente/ot/" + otUuid, "otId", otUuid.toString())), any());
    }

    @Test
    void presupuestoAprobadoVaAlTecnicoEnCanalDeActualizacion() {
        UUID otUuid = UUID.randomUUID();
        when(ot.getId()).thenReturn(new OtId(otUuid));
        Tecnico tecnico = mock(Tecnico.class);
        when(tecnico.getUsuarioId()).thenReturn(7L);
        when(tecnicos.findByIdAndActivoTrue(tecnicoId)).thenReturn(Optional.of(tecnico));
        Instant ahora = Instant.now();
        when(dispositivos.listarPorUsuario(7L, FcmNotificacionPushAdapter.MAX_DISPOSITIVOS))
                .thenReturn(List.of(new DispositivoPush(1L, 7L, "tok-tec", "ANDROID", ahora, ahora)));

        adapter.notificarPresupuestoAprobado(tecnicoId, ot);

        verify(sender).enviar(eq("tok-tec"), eq(CanalPush.OT_UPDATE_TEC), eq("Presupuesto aprobado"),
                eq("El cliente aprobó el presupuesto. Ya puedes iniciar la reparación."),
                eq(Map.of("ruta", "/tecnico/ejecucion/" + otUuid, "otId", otUuid.toString())), any());
    }

    private void clienteConDispositivo(ClienteId clienteId, long usuarioId, String token) {
        Cliente cliente = mock(Cliente.class);
        when(cliente.getUsuarioId()).thenReturn(new UsuarioId(usuarioId));
        when(clientes.buscarPorId(clienteId)).thenReturn(Optional.of(cliente));
        Instant ahora = Instant.now();
        when(dispositivos.listarPorUsuario(usuarioId, FcmNotificacionPushAdapter.MAX_DISPOSITIVOS))
                .thenReturn(List.of(new DispositivoPush(3L, usuarioId, token, "ANDROID", ahora, ahora)));
    }
}
