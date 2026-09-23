package com.sena.cold_day.core.modules.maps.infrastructure.google;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import tools.jackson.databind.JsonNode;

import com.sena.cold_day.core.modules.maps.domain.model.DireccionGeocodificada;
import com.sena.cold_day.core.modules.maps.domain.model.RutaCalculada;
import com.sena.cold_day.core.modules.maps.domain.model.SugerenciaDireccion;
import com.sena.cold_day.core.modules.maps.domain.services.MapsPort;
import com.sena.cold_day.core.modules.maps.infrastructure.config.MapsProperties;

/**
 * Adaptador Google Maps Platform (server key, solo backend).
 * Endpoints usados — habilitar en Google Cloud Console:
 * Geocoding API, Places API, Distance Matrix API.
 */
@Component
public class GoogleMapsAdapter implements MapsPort {

    private static final String GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
    private static final String AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
    private static final String DISTANCE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

    private static final String PARAM_LANGUAGE = "language";
    private static final String PARAM_REGION = "region";
    private static final String FIELD_RESULTS = "results";
    private static final String FIELD_STATUS = "status";
    private static final String STATUS_ZERO_RESULTS = "ZERO_RESULTS";
    private static final String LAT_LNG_FORMAT = "%f,%f";

    private final MapsProperties props;
    private final RestClient rest;

    @Autowired
    public GoogleMapsAdapter(MapsProperties props) {
        this(props, buildRestClient(props));
    }

    /** Test seam: lets ITs/unit tests inject a stubbed RestClient. */
    GoogleMapsAdapter(MapsProperties props, RestClient rest) {
        this.props = props;
        this.rest = rest;
    }

    private static RestClient buildRestClient(MapsProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.timeoutMs());
        factory.setReadTimeout(props.timeoutMs());
        return RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public Optional<DireccionGeocodificada> geocodificar(String direccion) {
        String url = UriComponentsBuilder.fromUriString(GEOCODE_URL)
                .queryParam("address", direccion)
                .queryParam("key", props.apiKey())
                .queryParam(PARAM_LANGUAGE, props.language())
                .queryParam(PARAM_REGION, props.region())
                .build().toUriString();
        JsonNode root = get(url);
        assertOk(root, "geocodificación");
        if (!root.path(FIELD_RESULTS).isArray() || root.path(FIELD_RESULTS).isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(leerDireccion(root.path(FIELD_RESULTS).get(0)));
    }

    @Override
    public Optional<DireccionGeocodificada> inversa(double latitud, double longitud) {
        String latlng = String.format(Locale.US, LAT_LNG_FORMAT, latitud, longitud);
        String url = UriComponentsBuilder.fromUriString(GEOCODE_URL)
                .queryParam("latlng", latlng)
                .queryParam("key", props.apiKey())
                .queryParam(PARAM_LANGUAGE, props.language())
                .queryParam(PARAM_REGION, props.region())
                .build().toUriString();
        JsonNode root = get(url);
        assertOk(root, "geocodificación inversa");
        if (!root.path(FIELD_RESULTS).isArray() || root.path(FIELD_RESULTS).isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(leerDireccion(root.path(FIELD_RESULTS).get(0)));
    }

    @Override
    public List<SugerenciaDireccion> autocompletar(String texto, Double sesgoLat, Double sesgoLng) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(AUTOCOMPLETE_URL)
                .queryParam("input", texto)
                .queryParam("key", props.apiKey())
                .queryParam(PARAM_LANGUAGE, props.language())
                .queryParam("components", "country:CO");
        if (sesgoLat != null && sesgoLng != null) {
            builder.queryParam("location", String.format(Locale.US, LAT_LNG_FORMAT, sesgoLat, sesgoLng));
            builder.queryParam("radius", 50000);
        }
        JsonNode root = get(builder.build().toUriString());
        String status = root.path(FIELD_STATUS).asText("");
        if (STATUS_ZERO_RESULTS.equals(status)) {
            return List.of();
        }
        assertOk(root, "autocompletado");
        List<SugerenciaDireccion> out = new ArrayList<>();
        for (JsonNode p : root.path("predictions")) {
            String desc = p.path("description").asText("");
            String placeId = p.path("place_id").asText(null);
            if (!desc.isBlank()) {
                out.add(new SugerenciaDireccion(desc, placeId));
            }
        }
        return out;
    }

    @Override
    public Optional<RutaCalculada> distancia(double origenLat, double origenLng, double destinoLat, double destinoLng) {
        String origins = String.format(Locale.US, LAT_LNG_FORMAT, origenLat, origenLng);
        String destinations = String.format(Locale.US, LAT_LNG_FORMAT, destinoLat, destinoLng);
        String url = UriComponentsBuilder.fromUriString(DISTANCE_URL)
                .queryParam("origins", origins)
                .queryParam("destinations", destinations)
                .queryParam("key", props.apiKey())
                .queryParam(PARAM_LANGUAGE, props.language())
                .queryParam(PARAM_REGION, props.region())
                .build().toUriString();
        JsonNode root = get(url);
        assertOk(root, "cálculo de distancia");
        JsonNode element = root.path("rows").path(0).path("elements").path(0);
        String status = element.path(FIELD_STATUS).asText("");
        if (STATUS_ZERO_RESULTS.equals(status) || "NOT_FOUND".equals(status)) {
            return Optional.empty();
        }
        if (!"OK".equals(status)) {
            throw new IllegalStateException("Distance Matrix respondió: " + status);
        }
        double metros = element.path("distance").path("value").asDouble(0);
        double segundos = element.path("duration").path("value").asDouble(0);
        return Optional.of(new RutaCalculada(
                metros / 1000.0,
                segundos / 60.0,
                element.path("distance").path("text").asText(""),
                element.path("duration").path("text").asText("")));
    }

    private JsonNode get(String url) {
        JsonNode body;
        try {
            body = rest.get().uri(url).retrieve().body(JsonNode.class);
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo contactar Google Maps Platform: " + ex.getMessage(), ex);
        }
        if (body == null) {
            throw new IllegalStateException("Google Maps Platform devolvió una respuesta vacía");
        }
        return body;
    }

    private DireccionGeocodificada leerDireccion(JsonNode node) {
        JsonNode loc = node.path("geometry").path("location");
        return new DireccionGeocodificada(
                node.path("formatted_address").asText(""),
                loc.path("lat").asDouble(),
                loc.path("lng").asDouble(),
                node.path("place_id").asText(null));
    }

    private void assertOk(JsonNode root, String operacion) {
        String status = root.path(FIELD_STATUS).asText("");
        if ("OK".equals(status) || STATUS_ZERO_RESULTS.equals(status)) {
            return;
        }
        if ("REQUEST_DENIED".equals(status)) {
            throw new IllegalStateException(
                    "Google rechazó la petición (" + operacion + "): "
                            + root.path("error_message").asText(status)
                            + " — verifica que la API esté habilitada y la restricción de la key.");
        }
        if ("OVER_QUERY_LIMIT".equals(status)) {
            throw new IllegalStateException("Cuota de Google Maps excedida (" + operacion + ").");
        }
        throw new IllegalStateException("Google Maps falló (" + operacion + "): " + status);
    }
}
