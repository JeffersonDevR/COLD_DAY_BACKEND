package com.sena.cold_day.core.modules.proveedores.application.usecases;

import org.slf4j.Logger;

/**
 * Notifications are best-effort (design AD11): they run only AFTER the
 * authoritative writes and a transport failure is logged, never propagated, so
 * it can never change the persisted request or its offers.
 */
final class NotificacionBestEffort {

    private NotificacionBestEffort() {
    }

    static void ejecutar(Runnable envio, Logger log, String descripcion) {
        try {
            envio.run();
        } catch (RuntimeException ex) {
            log.warn("No se pudo notificar {}: {}", descripcion, ex.getMessage());
        }
    }
}
