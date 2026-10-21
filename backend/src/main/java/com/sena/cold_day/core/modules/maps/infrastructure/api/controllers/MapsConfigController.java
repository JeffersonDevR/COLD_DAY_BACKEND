package com.sena.cold_day.core.modules.maps.infrastructure.api.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.maps.infrastructure.api.responses.MapsApiResponses.BoundsApiResponse;
import com.sena.cold_day.core.modules.maps.infrastructure.api.responses.MapsApiResponses.CentroApiResponse;
import com.sena.cold_day.core.modules.maps.infrastructure.api.responses.MapsApiResponses.ConfigMapaApiResponse;
import com.sena.cold_day.core.modules.maps.infrastructure.config.MapsConfigProperties;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Map view configuration for the frontend.
 *
 * <p>It is public on purpose: the map loader reads it before the user signs in
 * (the login and registration screens show a map) and it carries no personal
 * data, only the center, the metropolitan bounds, the zoom and the radius
 * ladder. The server key is never part of the payload; the browser key is
 * restricted by HTTP referrer and is the only one exposed.
 */
@RestController
@RequestMapping("/api/config/maps")
@Tag(name = "Maps Config", description = "Map view configuration (center, bounds, zoom, radius ladder)")
public class MapsConfigController {

    private final MapsConfigProperties properties;

    public MapsConfigController(MapsConfigProperties properties) {
        this.properties = properties;
    }

    @GetMapping
    @Operation(summary = "Map view configuration consumed by the frontend")
    public ConfigMapaApiResponse config() {
        return new ConfigMapaApiResponse(
                properties.browserApiKey(),
                new CentroApiResponse(properties.centroLat(), properties.centroLng()),
                new BoundsApiResponse(properties.boundsNorth(), properties.boundsSouth(), properties.boundsEast(),
                        properties.boundsWest()),
                properties.zoom(),
                properties.radioInicialKm(),
                properties.radioMaxKm(),
                properties.radioPasoKm());
    }
}
