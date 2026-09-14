package com.sena.cold_day.core.modules.ot.domain.services;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Delivery port for dispatch notifications (design D6). Transport is optional:
 * the in-app offer state is authoritative, so FCM can ship later behind this
 * boundary while a logging/no-op adapter ships now.
 */
public interface NotificacionPushPort {

    /** Notifies an eligible technician about a new pending offer. */
    void notificarOferta(TecnicoId tecnicoId, OfertaOt oferta, Ot ot);

    /** Notifies the client that dispatch ended without a technician. */
    void notificarCliente(ClienteId clienteId, Ot ot, String mensaje);
}
