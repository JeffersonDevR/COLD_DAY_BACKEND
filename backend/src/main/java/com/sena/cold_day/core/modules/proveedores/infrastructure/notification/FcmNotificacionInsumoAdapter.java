package com.sena.cold_day.core.modules.proveedores.infrastructure.notification;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.ot.infrastructure.notification.CanalPush;
import com.sena.cold_day.core.modules.ot.infrastructure.notification.FcmSender;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.DispositivoPush;
import com.sena.cold_day.core.modules.usuarios.domain.repository.DispositivoPushRepository;

/**
 * Push delivery of the insumo dispatch by FCM (active with
 * {@code app.push.fcm.enabled=true}). The persisted request and offers stay the
 * source of truth: any failure is swallowed, never breaks the dispatch and never
 * changes state. The body carries no personal data (no names, no address): only
 * counts, distance and minutes. It reuses the OT push transport ({@link FcmSender},
 * {@link CanalPush}) and the per-user device registry.
 */
@Component
@ConditionalOnProperty(name = "app.push.fcm.enabled", havingValue = "true")
public class FcmNotificacionInsumoAdapter implements NotificacionInsumoPort {

    /** Device cap per user, same as the OT push adapter. */
    static final int MAX_DISPOSITIVOS = 10;

    private final FcmSender sender;
    private final DispositivoPushRepository dispositivos;
    private final ProveedorRepository proveedores;
    private final TecnicoRepository tecnicos;

    public FcmNotificacionInsumoAdapter(FcmSender sender, DispositivoPushRepository dispositivos,
            ProveedorRepository proveedores, TecnicoRepository tecnicos) {
        this.sender = sender;
        this.dispositivos = dispositivos;
        this.proveedores = proveedores;
        this.tecnicos = tecnicos;
    }

    @Override
    public void notificarSolicitud(ProveedorId proveedorId, OfertaInsumo oferta, RequerimientoInsumo requerimiento) {
        try {
            proveedores.buscarPorId(proveedorId).ifPresent(proveedor -> {
                int piezas = requerimiento.getItems().stream().mapToInt(item -> item.getCantidad()).sum();
                String distancia = oferta.getDistanciaKm() == null ? ""
                        : " a " + String.format(Locale.ROOT, "%.1f", oferta.getDistanciaKm()) + " km de ti";
                enviar(proveedor.getUsuarioId(), CanalPush.INSUMO_NUEVO_PROV, "Nueva solicitud de repuestos",
                        "Hay un pedido de " + piezas + (piezas == 1 ? " repuesto" : " repuestos") + distancia
                                + ". Acéptalo antes de que otro proveedor lo tome.",
                        Map.of("ruta", "/proveedor/insumos", "requerimientoId", requerimiento.getId().valor().toString()));
            });
        } catch (RuntimeException e) {
            // The dispatch does not depend on push.
        }
    }

    @Override
    public void notificarAceptada(RequerimientoInsumo requerimiento) {
        String cuerpo = requerimiento.getEtaMinutos() == null
                ? "Un proveedor tomó tu pedido de repuestos."
                : "Un proveedor tomó tu pedido y se comprometió a llevarlo en unos " + requerimiento.getEtaMinutos()
                        + " min.";
        alTecnico(requerimiento, "Tus repuestos tienen proveedor", cuerpo);
    }

    @Override
    public void notificarDespachada(RequerimientoInsumo requerimiento) {
        alTecnico(requerimiento, "Tus repuestos van en camino", "El proveedor despachó tu pedido.");
    }

    @Override
    public void notificarEntregada(RequerimientoInsumo requerimiento) {
        alTecnico(requerimiento, "Repuestos entregados", "El proveedor confirmó la entrega de tu pedido.");
    }

    @Override
    public void notificarEtaVencido(RequerimientoInsumo requerimiento) {
        alTecnico(requerimiento, "Tus repuestos se están demorando",
                "Ya pasó el tiempo que el proveedor prometió. Revisa el estado de tu pedido.");
    }

    private void alTecnico(RequerimientoInsumo requerimiento, String titulo, String cuerpo) {
        try {
            tecnicos.findByIdAndActivoTrue(new TecnicoId(requerimiento.getTecnicoId()))
                    .ifPresent(tecnico -> enviar(tecnico.getUsuarioId(), CanalPush.OT_UPDATE_TEC, titulo, cuerpo,
                            Map.of("ruta", "/tecnico/ejecucion/" + requerimiento.getOtId(),
                                    "otId", requerimiento.getOtId().toString())));
        } catch (RuntimeException e) {
            // The dispatch does not depend on push.
        }
    }

    private void enviar(Long usuarioId, CanalPush canal, String titulo, String cuerpo, Map<String, String> datos) {
        try {
            List<DispositivoPush> destinos = dispositivos.listarPorUsuario(usuarioId, MAX_DISPOSITIVOS);
            for (DispositivoPush destino : destinos) {
                sender.enviar(destino.token(), canal, titulo, cuerpo, datos,
                        token -> dispositivos.eliminar(usuarioId, token));
            }
        } catch (RuntimeException e) {
            // The dispatch does not depend on push.
        }
    }
}
