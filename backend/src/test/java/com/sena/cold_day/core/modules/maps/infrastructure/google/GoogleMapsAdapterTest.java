package com.sena.cold_day.core.modules.maps.infrastructure.google;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.sena.cold_day.core.modules.maps.infrastructure.config.MapsProperties;

/**
 * Google Maps Platform adapter against a stubbed HTTP server: status mapping,
 * response parsing and the defensive null-body guard.
 */
class GoogleMapsAdapterTest {

    private static final MapsProperties PROPS = new MapsProperties("server-key", true, "es", "CO", 4000);

    private MockRestServiceServer server;
    private GoogleMapsAdapter adapter;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        adapter = new GoogleMapsAdapter(PROPS, builder.build());
    }

    @Test
    void geocodificarParsesTheFirstResult() {
        server.expect(requestTo(Matchers.containsString("/geocode/json")))
                .andRespond(withSuccess("""
                        {"status":"OK","results":[{"formatted_address":"Calle 1, Cucuta",
                        "geometry":{"location":{"lat":7.8,"lng":-72.5}},"place_id":"pid"}]}
                        """, MediaType.APPLICATION_JSON));

        var resultado = adapter.geocodificar("Calle 1");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().direccionFormateada()).isEqualTo("Calle 1, Cucuta");
        assertThat(resultado.get().latitud()).isEqualTo(7.8);
        assertThat(resultado.get().placeId()).isEqualTo("pid");
        server.verify();
    }

    @Test
    void geocodificarReturnsEmptyOnZeroResults() {
        server.expect(requestTo(Matchers.containsString("/geocode/json")))
                .andRespond(withSuccess("{\"status\":\"ZERO_RESULTS\",\"results\":[]}", MediaType.APPLICATION_JSON));

        assertThat(adapter.geocodificar("Nada")).isEmpty();
    }

    @Test
    void geocodificarFailsOnRequestDenied() {
        server.expect(requestTo(Matchers.containsString("/geocode/json")))
                .andRespond(withSuccess("{\"status\":\"REQUEST_DENIED\",\"error_message\":\"API off\"}",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> adapter.geocodificar("Calle 1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("API off");
    }

    @Test
    void geocodificarFailsOnOverQueryLimit() {
        server.expect(requestTo(Matchers.containsString("/geocode/json")))
                .andRespond(withSuccess("{\"status\":\"OVER_QUERY_LIMIT\"}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> adapter.geocodificar("Calle 1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Cuota");
    }

    @Test
    void inversaParsesTheResult() {
        server.expect(requestTo(Matchers.containsString("/geocode/json")))
                .andRespond(withSuccess("""
                        {"status":"OK","results":[{"formatted_address":"Calle 2",
                        "geometry":{"location":{"lat":7.9,"lng":-72.6}},"place_id":"pid2"}]}
                        """, MediaType.APPLICATION_JSON));

        assertThat(adapter.inversa(7.9, -72.6)).isPresent();
    }

    @Test
    void autocompletarMapsPredictionsAndSkipsBlankDescriptions() {
        server.expect(requestTo(Matchers.containsString("/place/autocomplete/json")))
                .andRespond(withSuccess("""
                        {"status":"OK","predictions":[
                        {"description":"Calle 1","place_id":"p1"},
                        {"description":"","place_id":"p2"}]}
                        """, MediaType.APPLICATION_JSON));

        var sugerencias = adapter.autocompletar("Calle", 7.8, -72.5);

        assertThat(sugerencias).hasSize(1);
        assertThat(sugerencias.get(0).descripcion()).isEqualTo("Calle 1");
    }

    @Test
    void autocompletarShortCircuitsOnZeroResults() {
        server.expect(requestTo(Matchers.containsString("/place/autocomplete/json")))
                .andRespond(withSuccess("{\"status\":\"ZERO_RESULTS\"}", MediaType.APPLICATION_JSON));

        assertThat(adapter.autocompletar("Calle", null, null)).isEmpty();
    }

    @Test
    void distanciaParsesDistanceAndDuration() {
        server.expect(requestTo(Matchers.containsString("/distancematrix/json")))
                .andRespond(withSuccess("""
                        {"status":"OK","rows":[{"elements":[{"status":"OK",
                        "distance":{"value":1500,"text":"1.5 km"},
                        "duration":{"value":300,"text":"5 min"}}]}]}
                        """, MediaType.APPLICATION_JSON));

        var ruta = adapter.distancia(7.8, -72.5, 7.9, -72.6);

        assertThat(ruta).isPresent();
        assertThat(ruta.get().distanciaKm()).isEqualTo(1.5);
        assertThat(ruta.get().duracionMin()).isEqualTo(5.0);
    }

    @Test
    void distanciaReturnsEmptyWhenThereIsNoRoute() {
        server.expect(requestTo(Matchers.containsString("/distancematrix/json")))
                .andRespond(withSuccess("""
                        {"status":"OK","rows":[{"elements":[{"status":"ZERO_RESULTS"}]}]}
                        """, MediaType.APPLICATION_JSON));

        assertThat(adapter.distancia(7.8, -72.5, 7.9, -72.6)).isEmpty();
    }

    @Test
    void distanciaFailsOnAnUnexpectedElementStatus() {
        server.expect(requestTo(Matchers.containsString("/distancematrix/json")))
                .andRespond(withSuccess("""
                        {"status":"OK","rows":[{"elements":[{"status":"INVALID_REQUEST"}]}]}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> adapter.distancia(7.8, -72.5, 7.9, -72.6))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("INVALID_REQUEST");
    }

    @Test
    void anEmptyBodyIsRejectedDefensively() {
        server.expect(requestTo(Matchers.containsString("/geocode/json")))
                .andRespond(withStatus(HttpStatus.NO_CONTENT));

        assertThatThrownBy(() -> adapter.geocodificar("Calle 1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("respuesta vacía");
    }

    @Test
    void aTransportFailureIsWrapped() {
        server.expect(requestTo(Matchers.containsString("/geocode/json")))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() -> adapter.geocodificar("Calle 1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No se pudo contactar");
    }
}
