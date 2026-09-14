package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.listeners;

import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.geolocalizacion.application.usecases.DesactivarTrackingTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Tracking deactivation seam for the OT lifecycle (RF-F1-27).
 *
 * <p><strong>PR5-dependent wiring.</strong> The OT aggregate and its terminal
 * events ({@code OtFinalizada}, {@code OtCancelada}, {@code OtSinTecnicosDisponibles})
 * do not exist yet. When PR5 lands, this component must subscribe to them,
 * for example:
 *
 * <pre>{@code
 * @EventListener
 * void on(OtFinalizada event) { desactivarTracking(event.tecnicoId()); }
 * }</pre>
 *
 * <p>PR4 deliberately exposes the delegation method instead of inventing OT
 * types, so the deactivation behavior is proven end to end without the OT
 * aggregate. PR5 decides in-transaction error handling for a missing profile.
 */
@Component
public class DesactivarTrackingListener {

    private final DesactivarTrackingTecnicoUseCase desactivarTracking;

    public DesactivarTrackingListener(DesactivarTrackingTecnicoUseCase desactivarTracking) {
        this.desactivarTracking = desactivarTracking;
    }

    /** PR5 hook target: stop tracking for the technician of a terminal OT. */
    public void desactivarTracking(TecnicoId tecnicoId) {
        desactivarTracking.desactivar(tecnicoId);
    }
}
