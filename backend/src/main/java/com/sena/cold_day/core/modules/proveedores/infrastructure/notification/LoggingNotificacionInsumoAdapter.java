package com.sena.cold_day.core.modules.proveedores.infrastructure.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

/**
 * Logging delivery of insumo dispatch notifications (design AD11/AD14). FCM
 * transport is deferred: the persisted offer state is authoritative and dispatch
 * must never block on push delivery, so this adapter only records the event and
 * never propagates an exception.
 */
@Component
public class LoggingNotificacionInsumoAdapter implements NotificacionInsumoPort {

    private static final Logger log = LoggerFactory.getLogger(LoggingNotificacionInsumoAdapter.class);

    @Override
    public void notificarSolicitud(ProveedorId proveedorId, OfertaInsumo oferta,
            RequerimientoInsumo requerimiento) {
        log.info("Solicitud de insumos despachada: requerimiento={} ot={} proveedor={} oferta={} expiraEn={}",
                requerimiento.getId(), requerimiento.getOtId(), proveedorId, oferta.getId(),
                oferta.getExpiraEn());
    }
}
