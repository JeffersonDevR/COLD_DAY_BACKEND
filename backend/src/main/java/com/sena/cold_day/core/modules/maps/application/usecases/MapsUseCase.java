package com.sena.cold_day.core.modules.maps.application.usecases;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.maps.domain.exception.MapsNoDisponibleException;
import com.sena.cold_day.core.modules.maps.domain.model.DireccionGeocodificada;
import com.sena.cold_day.core.modules.maps.domain.model.RutaCalculada;
import com.sena.cold_day.core.modules.maps.domain.model.SugerenciaDireccion;
import com.sena.cold_day.core.modules.maps.domain.services.MapsPort;
import com.sena.cold_day.core.modules.maps.infrastructure.config.MapsProperties;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Fachada de casos de uso Maps: valida disponibilidad (503 accionable),
 * valida rangos con {@link Point} y delega al puerto.
 */
@Service
public class MapsUseCase {

    private final MapsPort maps;
    private final MapsProperties props;

    public MapsUseCase(MapsPort maps, MapsProperties props) {
        this.maps = maps;
        this.props = props;
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
    public Optional<RutaCalculada> distanciaOpcional(double oLat, double oLng, double dLat, double dLng) {
        Point o = new Point(oLat, oLng);
        Point d = new Point(dLat, dLng);
        if (!props.usable()) {
            return Optional.empty();
        }
        try {
            return maps.distancia(o.latitud(), o.longitud(), d.latitud(), d.longitud());
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
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
