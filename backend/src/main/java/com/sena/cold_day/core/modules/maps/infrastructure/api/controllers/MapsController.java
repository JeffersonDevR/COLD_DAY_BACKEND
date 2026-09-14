package com.sena.cold_day.core.modules.maps.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.sena.cold_day.core.modules.maps.application.usecases.MapsUseCase;
import com.sena.cold_day.core.modules.maps.infrastructure.api.requests.MapsApiRequests.DistanciaApiRequest;
import com.sena.cold_day.core.modules.maps.infrastructure.api.requests.MapsApiRequests.GeocodeApiRequest;
import com.sena.cold_day.core.modules.maps.infrastructure.api.responses.MapsApiResponses.DireccionApiResponse;
import com.sena.cold_day.core.modules.maps.infrastructure.api.responses.MapsApiResponses.DistanciaApiResponse;
import com.sena.cold_day.core.modules.maps.infrastructure.api.responses.MapsApiResponses.EstadoApiResponse;
import com.sena.cold_day.core.modules.maps.infrastructure.api.responses.MapsApiResponses.SugerenciaApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Proxy seguro hacia Google Maps Platform: la server key nunca sale del
 * backend. El navegador usa su propia browser key (ver frontend
 * src/environments/*) solo para renderizar el mapa.
 */
@RestController
@RequestMapping("/api/maps")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Maps", description = "Proxy Google Maps Platform (geocodificación, autocompletado, distancia)")
@SecurityRequirement(name = "bearer-jwt")
public class MapsController {

    private final MapsUseCase maps;

    public MapsController(MapsUseCase maps) {
        this.maps = maps;
    }

    @GetMapping("/estado")
    @Operation(summary = "Dice si Maps está habilitado y configurado (sin exponer la key)")
    public EstadoApiResponse estado() {
        MapsUseCase.MapsEstado e = maps.estado();
        return new EstadoApiResponse(e.enabled(), e.configured(), e.language(), e.region());
    }

    @PostMapping("/geocode")
    @Operation(summary = "Dirección de texto → coordenadas (Geocoding API)")
    public DireccionApiResponse geocode(@Valid @RequestBody GeocodeApiRequest body) {
        return maps.geocodificar(body.direccion())
                .map(DireccionApiResponse::de)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sin resultados para esa dirección"));
    }

    @GetMapping("/inversa")
    @Operation(summary = "Coordenadas → dirección (reverse geocoding)")
    public DireccionApiResponse inversa(
            @RequestParam @DecimalMin("-90.0") @DecimalMax("90.0") double lat,
            @RequestParam @DecimalMin("-180.0") @DecimalMax("180.0") double lng) {
        return maps.inversa(lat, lng)
                .map(DireccionApiResponse::de)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sin dirección para esas coordenadas"));
    }

    @GetMapping("/autocompletar")
    @Operation(summary = "Sugerencias de dirección (Places Autocomplete, sesgo Colombia)")
    public List<SugerenciaApiResponse> autocompletar(
            @RequestParam @NotBlank @Size(min = 3, max = 200) String input,
            @RequestParam(required = false) @DecimalMin("-90.0") @DecimalMax("90.0") Double lat,
            @RequestParam(required = false) @DecimalMin("-180.0") @DecimalMax("180.0") Double lng) {
        return maps.autocompletar(input, lat, lng).stream().map(SugerenciaApiResponse::de).toList();
    }

    @PostMapping("/distancia")
    @ResponseStatus(HttpStatus.OK)
    @Operation(summary = "Distancia vial + ETA entre dos puntos (Distance Matrix)")
    public DistanciaApiResponse distancia(@Valid @RequestBody DistanciaApiRequest body) {
        return maps.distancia(body.origenLat(), body.origenLng(), body.destinoLat(), body.destinoLng())
                .map(DistanciaApiResponse::de)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sin ruta entre esos puntos"));
    }
}
