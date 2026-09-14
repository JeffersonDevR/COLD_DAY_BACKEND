package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.listeners;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.geolocalizacion.application.usecases.DesactivarTrackingTecnicoUseCase;
import com.sena.cold_day.core.modules.ot.domain.events.EventoTerminalOt;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Tracking deactivation on OT terminal states (RF-F1-27, design D3).
 *
 * <p>Subscribes to {@link EventoTerminalOt}, the common contract of
 * {@code OtFinalizada}, {@code OtCancelada} and {@code OtSinTecnicosDisponibles}.
 * Only events carrying an assigned technician act: a client cancellation before
 * assignment and the negative terminal state leave no technician to deactivate.
 * The final coordinates remain persisted for audit.
 *
 * <p>PR4 seam decision (task 4.6): a listener runs in the terminal transition
 * transaction, so a missing technician profile (or an already inactive one) is
 * tolerated and logged. Rolling back the terminal OT state because tracking had
 * nothing to deactivate would violate RF-F1-10.
 */
@Component
public class DesactivarTrackingListener {

    private static final Logger log = LoggerFactory.getLogger(DesactivarTrackingListener.class);

    private final DesactivarTrackingTecnicoUseCase desactivarTracking;

    public DesactivarTrackingListener(DesactivarTrackingTecnicoUseCase desactivarTracking) {
        this.desactivarTracking = desactivarTracking;
    }

    /** Reacts to any OT terminal event that has an assigned technician. */
    @EventListener
    public void onEventoTerminal(EventoTerminalOt evento) {
        evento.tecnicoAsignado().ifPresent(this::desactivarTracking);
    }

    /** Stops tracking for the technician of a terminal OT. */
    public void desactivarTracking(TecnicoId tecnicoId) {
        try {
            desactivarTracking.desactivar(tecnicoId);
        } catch (TecnicoNoEncontradoException exception) {
            log.warn("No se pudo desactivar el tracking: tecnico no encontrado {}", tecnicoId, exception);
        }
    }
}
