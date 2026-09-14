package com.sena.cold_day.core.modules.maps.domain.exception;

/**
 * Google Maps no está disponible: módulo deshabilitado
 * (GOOGLE_MAPS_ENABLED=false) o sin server key (GOOGLE_MAPS_API_KEY vacía).
 * El controller la traduce a 503 con el archivo exacto donde poner la clave.
 */
public class MapsNoDisponibleException extends RuntimeException {

    public MapsNoDisponibleException(String message) {
        super(message);
    }

    public static MapsNoDisponibleException sinClave() {
        return new MapsNoDisponibleException(
                "Google Maps no configurado: define GOOGLE_MAPS_API_KEY en backend/.env "
                        + "(ver backend/.env.example) o como variable de entorno.");
    }

    public static MapsNoDisponibleException deshabilitado() {
        return new MapsNoDisponibleException(
                "Google Maps deshabilitado: pon GOOGLE_MAPS_ENABLED=true en backend/.env.");
    }
}
