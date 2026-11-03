package com.sena.cold_day.core.modules.maps.application.usecases;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.maps.domain.exception.MapsNoDisponibleException;
import com.sena.cold_day.core.modules.maps.domain.model.DireccionGeocodificada;
import com.sena.cold_day.core.modules.maps.domain.model.Ruta;
import com.sena.cold_day.core.modules.maps.domain.model.RutaCalculada;
import com.sena.cold_day.core.modules.maps.domain.model.SugerenciaDireccion;
import com.sena.cold_day.core.modules.maps.domain.services.MapsPort;
import com.sena.cold_day.core.modules.maps.infrastructure.cache.RutaCache;
import com.sena.cold_day.core.modules.maps.infrastructure.config.MapsProperties;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Fachada de casos de uso Maps: valida disponibilidad (503 accionable),
 * valida rangos con {@link Point} y delega al puerto. Las rutas pasan primero
 * por {@link RutaCache}: es el guardia de costo de la única operación que el
 * frontend vuelve a pedir mientras el técnico se mueve.
 */
@Service
public class MapsUseCase {

    private final MapsPort maps;
    private final MapsProperties props;
    private final RutaCache rutas;

    public MapsUseCase(MapsPort maps, MapsProperties props, RutaCache rutas) {
        this.maps = maps;
        this.props = props;
        this.rutas = rutas;
    }

    public MapsEstado estado() {
        return new MapsEstado(props.enabled(), props.configured(), props.language(), props.region());
    }

    public Optional<DireccionGeocodificada> geocodificar(String direccion) {
        exigirDisponible();
        if (direccion == null || direccion.isBlank()) {
            throw new IllegalArgumentException("La dirección no puede estar vacía");
        }
        return maps.geocodificar(direccion.strip());
    }

    public Optional<DireccionGeocodificada> inversa(double latitud, double longitud) {
        exigirDisponible();
        Point p = new Point(latitud, longitud);
        return maps.inversa(p.latitud(), p.longitud());
    }

    public List<SugerenciaDireccion> autocompletar(String texto, Double lat, Double lng) {
        exigirDisponible();
        if (texto == null || texto.strip().length() < 3) {
            throw new IllegalArgumentException("El texto debe tener al menos 3 caracteres");
        }
        Double la = null;
        Double ln = null;
        if (lat != null && lng != null) {
            Point p = new Point(lat, lng);
            la = p.latitud();
            ln = p.longitud();
        }
        return maps.autocompletar(texto.strip(), la, ln);
    }

    public Optional<RutaCalculada> distancia(double oLat, double oLng, double dLat, double dLng) {
        exigirDisponible();
        Point o = new Point(oLat, oLng);
        Point d = new Point(dLat, dLng);
        return maps.distancia(o.latitud(), o.longitud(), d.latitud(), d.longitud());
    }

    /**
     * Non-throwing distance lookup (design AD10). Returns {@code Optional.empty()}
     * when maps is disabled, unconfigured, has no route or fails, so the caller can
     * fall back to Haversine and a third party never blocks OT creation. Unlike
     * {@link #distancia(double, double, double, double)} this never raises
     * {@code MapsNoDisponibleException}.
     */
    @SuppressWarnings("java:S7467")
    public Optional<RutaCalculada> distanciaOpcional(double oLat, double oLng, double dLat, double dLng) {
        Point o = new Point(oLat, oLng);
        Point d = new Point(dLat, dLng);
        if (!props.usable()) {
            return Optional.empty();
        }
        try {
            return maps.distancia(o.latitud(), o.longitud(), d.latitud(), d.longitud());
        } catch (RuntimeException ex) {
            // ex es intencionalmente no usado: este método nunca debe lanzar
            // excepción, así que se traga y se devuelve Optional.empty().
            return Optional.empty();
        }
    }

    /**
     * Ruta real por calles (Directions API). Exige Maps disponible: si no lo
     * está, el 503 explica qué falta en vez de devolver una ruta inexistente.
     * La respuesta se sirve desde {@link RutaCache} cuando el par redondeado ya
     * se consultó dentro del TTL, de modo que un acierto no cuesta una llamada.
     */
    public Optional<Ruta> ruta(double oLat, double oLng, double dLat, double dLng) {
        exigirDisponible();
        return rutaCacheada(new Point(oLat, oLng), new Point(dLat, dLng));
    }

    /**
     * Non-throwing route lookup (same contract as
     * {@link #distanciaOpcional(double, double, double, double)}): an empty
     * result — never a 503 — when maps is disabled, unconfigured, has no route
     * or fails. The live map then degrades to a straight line instead of
     * breaking the tracking screen.
     */
    @SuppressWarnings("java:S7467")
    public Optional<Ruta> rutaOpcional(double oLat, double oLng, double dLat, double dLng) {
        Point o = new Point(oLat, oLng);
        Point d = new Point(dLat, dLng);
        if (!props.usable()) {
            return Optional.empty();
        }
        try {
            return rutaCacheada(o, d);
        } catch (RuntimeException ex) {
            // ex es intencionalmente no usado: este método nunca debe lanzar.
            return Optional.empty();
        }
    }

    private Optional<Ruta> rutaCacheada(Point origen, Point destino) {
        RutaCache.Key clave = RutaCache.Key.of(origen.latitud(), origen.longitud(), destino.latitud(),
                destino.longitud(), Ruta.MODO_CONDUCCION);
        Optional<RutaCache.Hit> enCache = rutas.find(clave);
        if (enCache.isPresent()) {
            return enCache.get().valor();
        }
        Optional<Ruta> calculada = maps.ruta(origen.latitud(), origen.longitud(), destino.latitud(),
                destino.longitud());
        rutas.put(clave, calculada);
        return calculada;
    }

    private void exigirDisponible() {
        if (!props.enabled()) {
            throw MapsNoDisponibleException.deshabilitado();
        }
        if (!props.configured()) {
            throw MapsNoDisponibleException.sinClave();
        }
    }

    public record MapsEstado(boolean enabled, boolean configured, String language, String region) {
    }
}
