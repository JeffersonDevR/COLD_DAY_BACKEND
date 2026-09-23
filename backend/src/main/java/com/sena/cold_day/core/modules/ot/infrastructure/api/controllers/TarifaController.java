package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.ot.application.usecases.EstimarTarifaUseCase;
import com.sena.cold_day.core.modules.ot.infrastructure.api.requests.TarifaApiRequest;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.TarifaEstimadaResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * Read-only tariff estimate (spec tar.R5): {@code POST /api/ot/tarifa/estimar}.
 * Any authenticated caller may estimate; the operation never creates or mutates
 * an OT. Validation failures surface as 400 through {@link OtControllerAdvice}.
 */
@RestController
@RequestMapping("/api/ot/tarifa")
@PreAuthorize("isAuthenticated()")
@Tag(name = "OT Tarifa", description = "Estimacion de tarifa de visita por distancia (solo lectura)")
@SecurityRequirement(name = "bearer-jwt")
public class TarifaController {

    private final EstimarTarifaUseCase estimarTarifa;

    public TarifaController(EstimarTarifaUseCase estimarTarifa) {
        this.estimarTarifa = estimarTarifa;
    }

    @PostMapping("/estimar")
    @ResponseStatus(HttpStatus.OK)
    @Operation(summary = "Estima la tarifa de visita para una ubicacion (no crea ni modifica la OT)")
    public TarifaEstimadaResponse estimar(@Valid @RequestBody TarifaApiRequest request) {
        return TarifaEstimadaResponse.de(estimarTarifa.estimar(request.latitud(), request.longitud()));
    }
}
