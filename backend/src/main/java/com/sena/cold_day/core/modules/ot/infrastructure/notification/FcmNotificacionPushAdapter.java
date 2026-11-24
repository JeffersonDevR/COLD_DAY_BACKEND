package com.sena.cold_day.core.modules.ot.infrastructure.notification;

import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.services.NotificacionPushPort;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.DispositivoPush;
import com.sena.cold_day.core.modules.usuarios.domain.repository.DispositivoPushRepository;

/**
 * Entrega push por FCM (activa con {@code app.push.fcm.enabled=true}). El
 * estado de la oferta en base sigue siendo la fuente de verdad: cualquier fallo
 * de push se traga y se loguea, nunca rompe el despacho. El cuerpo no lleva
 * datos personales (ni direccion ni nombre): solo categoria y codigo de la OT.
 */
@Component
@ConditionalOnProperty(name = "app.push.fcm.enabled", havingValue = "true")
public class FcmNotificacionPushAdapter implements NotificacionPushPort {

    /** Tope de dispositivos por usuario a los que se envia (BE-P1). */
    static final int MAX_DISPOSITIVOS = 10;

    private final FcmSender sender;
    private final DispositivoPushRepository dispositivos;
    private final TecnicoRepository tecnicos;
    private final ClienteRepository clientes;

    public FcmNotificacionPushAdapter(FcmSender sender, DispositivoPushRepository dispositivos,
            TecnicoRepository tecnicos, ClienteRepository clientes) {
        this.sender = sender;
        this.dispositivos = dispositivos;
        this.tecnicos = tecnicos;
        this.clientes = clientes;
    }

    @Override
    public void notificarOferta(TecnicoId tecnicoId, OfertaOt oferta, Ot ot) {
        tecnicos.findByIdAndActivoTrue(tecnicoId).ifPresent(tecnico ->
                enviar(tecnico.getUsuarioId(), CanalPush.OT_NUEVA_TEC, "Nueva oferta de servicio",
                        "Hay una orden de " + ot.getCategoriaServicio() + " cerca de ti. Acéptala antes de que expire.",
                        Map.of("ruta", "/tecnico/radar", "otId", ot.getId().valor().toString())));
    }

    @Override
    public void notificarCliente(ClienteId clienteId, Ot ot, String mensaje) {
        clientes.buscarPorId(clienteId).ifPresent(cliente ->
                enviar(cliente.getUsuarioId().valor(), CanalPush.OT_UPDATE_CLI, "Tu solicitud de servicio", mensaje,
                        Map.of("ruta", "/cliente/ot/" + ot.getId().valor(), "otId", ot.getId().valor().toString())));
    }

    @Override
    public void notificarPresupuestoEnviado(ClienteId clienteId, Ot ot) {
        clientes.buscarPorId(clienteId).ifPresent(cliente ->
                enviar(cliente.getUsuarioId().valor(), CanalPush.OT_NUEVA_CLI, "Presupuesto listo",
                        "El técnico envió el presupuesto de tu orden. Revísalo y apruébalo.",
                        datos("/cliente/ot/" + ot.getId().valor() + "/diagnostico", ot)));
    }

    @Override
    public void notificarOtAceptada(ClienteId clienteId, Ot ot) {
        clientes.buscarPorId(clienteId).ifPresent(cliente ->
                enviar(cliente.getUsuarioId().valor(), CanalPush.OT_NUEVA_CLI, "Técnico asignado",
                        "Un técnico aceptó tu orden de " + etiqueta(ot.getCategoriaServicio()) + ".",
                        datos("/cliente/ot/" + ot.getId().valor(), ot)));
    }

    @Override
    public void notificarPresupuestoAprobado(TecnicoId tecnicoId, Ot ot) {
        tecnicos.findByIdAndActivoTrue(tecnicoId).ifPresent(tecnico ->
                enviar(tecnico.getUsuarioId(), CanalPush.OT_UPDATE_TEC, "Presupuesto aprobado",
                        "El cliente aprobó el presupuesto. Ya puedes iniciar la reparación.",
                        datos("/tecnico/ejecucion/" + ot.getId().valor(), ot)));
    }

    /** AIRE_ACONDICIONADO -> "aire acondicionado": el aviso lo lee una persona. */
    private static String etiqueta(Enum<?> categoria) {
        return categoria == null ? "servicio" : categoria.name().toLowerCase(java.util.Locale.ROOT).replace('_', ' ');
    }

    private static Map<String, String> datos(String ruta, Ot ot) {
        return Map.of("ruta", ruta, "otId", ot.getId().valor().toString());
    }

    private void enviar(Long usuarioId, CanalPush canal, String titulo, String cuerpo, Map<String, String> datos) {
        try {
            List<DispositivoPush> destinos = dispositivos.listarPorUsuario(usuarioId, MAX_DISPOSITIVOS);
            for (DispositivoPush destino : destinos) {
                sender.enviar(destino.token(), canal, titulo, cuerpo, datos,
                        token -> dispositivos.eliminar(usuarioId, token));
            }
        } catch (RuntimeException e) {
            // El despacho no depende del push.
        }
    }
}
