package com.sena.cold_day.core.modules.usuarios.domain.services;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;

/**
 * Delivery port for password-recovery tokens (WS8, R1). The domain publishes
 * {@link RecuperacionSolicitada} and never knows which transport delivers it:
 * an SMTP adapter when mail is configured, a logging fallback otherwise. The
 * boundary keeps the transport replaceable without touching the use case.
 */
public interface NotificadorRecuperacion {

    /**
     * Delivers the recovery token carried by the event. Implementations must not
     * throw for a transient transport failure: dispatch happens after commit and
     * the persisted token remains the source of truth.
     */
    void notificar(RecuperacionSolicitada evento);
}
