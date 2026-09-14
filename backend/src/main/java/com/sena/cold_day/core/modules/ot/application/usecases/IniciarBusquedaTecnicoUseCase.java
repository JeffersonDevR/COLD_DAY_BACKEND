package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.geolocalizacion.domain.repository.TecnicoDisponibilidadRepository;
import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.services.NotificacionPushPort;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;

/**
 * CU-08/RF-F1-09: starts dispatch for an urgent OT. From {@code SOLICITADA} it
 * advances to {@code BUSCANDO_TECNICO} with the initial 10 km / 60 s window and
 * broadcasts one pending offer per eligible technician in the current radius.
 * The same {@link #ofrecer(Ot, double, Instant)} primitive is reused by radius
 * escalation, so offer creation lives in one place.
 */
@Service
public class IniciarBusquedaTecnicoUseCase {

    /** Initial dispatch radius (RF-F1-07). */
    public static final double RADIO_INICIAL_KM = 10.0;

    /** Server-authoritative offer window (design D6). */
    static final Duration VENTANA_BUSQUEDA = Duration.ofSeconds(60);

    private final OtRepository otRepository;
    private final OfertaOtRepository ofertaRepository;
    private final TecnicoDisponibilidadRepository disponibilidadRepository;
    private final NotificacionPushPort notificacionPush;
    private final Clock clock;

    public IniciarBusquedaTecnicoUseCase(OtRepository otRepository, OfertaOtRepository ofertaRepository,
            TecnicoDisponibilidadRepository disponibilidadRepository, NotificacionPushPort notificacionPush,
            Clock clock) {
        this.otRepository = otRepository;
        this.ofertaRepository = ofertaRepository;
        this.disponibilidadRepository = disponibilidadRepository;
        this.notificacionPush = notificacionPush;
        this.clock = clock;
    }

    /**
     * Transitions the OT to {@code BUSCANDO_TECNICO} and broadcasts the initial
     * offers. Returns the persisted aggregate.
     */
    @Transactional
    public Ot iniciar(Ot ot) {
        Instant ahora = clock.instant();
        ot.iniciarBusqueda(RADIO_INICIAL_KM, ahora.plus(VENTANA_BUSQUEDA), ActorOt.CLIENTE, ahora);
        Ot guardada = otRepository.save(ot);
        ejecutarOferta(guardada, RADIO_INICIAL_KM, ahora);
        return guardada;
    }

    /**
     * Creates and notifies one pending offer per eligible technician within the
     * radius. Returns how many technicians were offered the order.
     */
    @Transactional
    public int ofrecer(Ot ot, double radioKm, Instant ahora) {
        return ejecutarOferta(ot, radioKm, ahora);
    }

    private int ejecutarOferta(Ot ot, double radioKm, Instant ahora) {
        List<TecnicoCercano> disponibles = disponibilidadRepository
                .buscarDisponiblesEnRadio(ot.getUbicacion(), radioKm, Set.of(ot.getCategoriaServicio()));
        for (TecnicoCercano cercano : disponibles) {
            OfertaOt oferta = OfertaOt.crear(ot.getId(), cercano.tecnicoId(), radioKm, ahora,
                    ahora.plus(VENTANA_BUSQUEDA));
            OfertaOt guardada = ofertaRepository.save(oferta);
            notificacionPush.notificarOferta(cercano.tecnicoId(), guardada, ot);
        }
        return disponibles.size();
    }
}
