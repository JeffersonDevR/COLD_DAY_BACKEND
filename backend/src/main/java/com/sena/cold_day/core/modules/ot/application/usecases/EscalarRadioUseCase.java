package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtSinTecnicosDisponibles;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.services.NotificacionPushPort;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * RF-F1-09 escalation sweep (design D6). For every searching order whose 60 s
 * window closed with no acceptance it expires the pending offers and either
 * widens the radius by 5 km (10 -&gt; 15 -&gt; 20 -&gt; 25) and re-broadcasts, or at
 * the maximum radius lands in the negative terminal state
 * {@code SIN_TECNICOS_DISPONIBLES} and notifies the client.
 *
 * <p>Processing is guarded by the order's own window, so a repeated or illegal
 * sweep is a no-op rather than a double escalation.
 */
@Service
public class EscalarRadioUseCase {

    /** Maximum dispatch radius before the negative terminal state (RF-F1-09). */
    public static final double RADIO_MAXIMO_KM = 25.0;

    /** Radius growth per expired window (RF-F1-09). */
    public static final double INCREMENTO_KM = 5.0;

    static final Duration VENTANA_BUSQUEDA = Duration.ofSeconds(60);

    static final String MENSAJE_SIN_TECNICOS =
            "No se encontraron tecnicos disponibles en el radio maximo de busqueda";

    private final OtRepository otRepository;
    private final OfertaOtRepository ofertaRepository;
    private final IniciarBusquedaTecnicoUseCase iniciarBusqueda;
    private final NotificacionPushPort notificacionPush;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public EscalarRadioUseCase(OtRepository otRepository, OfertaOtRepository ofertaRepository,
            IniciarBusquedaTecnicoUseCase iniciarBusqueda, NotificacionPushPort notificacionPush,
            ApplicationEventPublisher events, Clock clock) {
        this.otRepository = otRepository;
        this.ofertaRepository = ofertaRepository;
        this.iniciarBusqueda = iniciarBusqueda;
        this.notificacionPush = notificacionPush;
        this.events = events;
        this.clock = clock;
    }

    /**
     * Processes every searching order whose window has closed. Returns how many
     * orders were escalated or terminated in this sweep.
     */
    @Transactional
    public int ejecutar() {
        Instant ahora = clock.instant();
        List<Ot> vencidas = otRepository.buscarVentanasVencidas(ahora);
        int procesadas = 0;
        for (Ot ot : vencidas) {
            if (!estaVencida(ot, ahora)) {
                continue;
            }
            ofertaRepository.expirarDe(ot.getId(), ahora);
            if (ot.getRadioKm() < RADIO_MAXIMO_KM) {
                escalar(ot, ahora);
            } else {
                agotar(ot, ahora);
            }
            procesadas++;
        }
        return procesadas;
    }

    /** Only a searching order whose own window is actually due may be processed. */
    private boolean estaVencida(Ot ot, Instant ahora) {
        return ot.getEstado() == EstadoOt.BUSCANDO_TECNICO
                && ot.getVentanaExpiraEn() != null
                && !ot.getVentanaExpiraEn().isAfter(ahora);
    }

    private void escalar(Ot ot, Instant ahora) {
        double nuevoRadio = Math.min(ot.getRadioKm() + INCREMENTO_KM, RADIO_MAXIMO_KM);
        ot.escalarRadio(nuevoRadio, ahora.plus(VENTANA_BUSQUEDA));
        otRepository.save(ot);
        iniciarBusqueda.ofrecer(ot, nuevoRadio, ahora);
    }

    private void agotar(Ot ot, Instant ahora) {
        ot.agotarOpciones(ActorOt.SISTEMA, ahora);
        otRepository.save(ot);
        notificacionPush.notificarCliente(ot.getClienteId(), ot, MENSAJE_SIN_TECNICOS);
        events.publishEvent(new OtSinTecnicosDisponibles(ot.getId(), ot.getClienteId()));
    }
}
