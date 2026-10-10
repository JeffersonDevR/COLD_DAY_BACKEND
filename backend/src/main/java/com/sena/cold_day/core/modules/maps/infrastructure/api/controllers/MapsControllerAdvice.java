package com.sena.cold_day.core.modules.maps.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.maps.domain.exception.MapsNoDisponibleException;
import com.sena.cold_day.core.shared.errors.ApiError;

/**
 * Traduce los fallos Maps al payload canónico {@link ApiError}.
 * 503 = falta clave / deshabilitado (ver backend/.env.example).
 * 502 = Google respondió error o no hubo contacto.
 */
@RestControllerAdvice(basePackageClasses = MapsController.class)
public class MapsControllerAdvice {

    /**
     * Validacion de los {@code @Valid @RequestBody} de Maps: mismo payload que
     * el resto de modulos. Sin este handler la validacion caia en el resolver
     * por defecto de Spring y devolvia un cuerpo que no era {@link ApiError}.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    @ExceptionHandler(MapsNoDisponibleException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public List<ApiError> noDisponible(MapsNoDisponibleException ex) {
        return List.of(new ApiError(HttpStatus.SERVICE_UNAVAILABLE.value(), ex.getMessage(), List.of()));
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public List<ApiError> googleFallo(IllegalStateException ex) {
        return List.of(new ApiError(HttpStatus.BAD_GATEWAY.value(), ex.getMessage(), List.of()));
    }
}
