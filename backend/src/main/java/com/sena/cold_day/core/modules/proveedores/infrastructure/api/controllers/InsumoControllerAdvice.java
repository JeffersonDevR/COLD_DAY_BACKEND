package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import com.sena.cold_day.core.modules.proveedores.domain.exception.OfertaInsumoNoDisponibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.RequerimientoInsumoNoEncontradoException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.TransicionRequerimientoInvalidaException;
import com.sena.cold_day.core.shared.errors.ApiError;

/**
 * Canonical error surface for the insumo dispatch API (design "API Contracts"),
 * reusing the shared {@code ApiError} shape. An ineligible or non-owning supplier
 * is a 403, a resolved/expired/losing offer and an illegal request transition are
 * conflicts (409), and an unknown request is a 404 — never an unhandled 500.
 */
@RestControllerAdvice(assignableTypes = InsumoController.class)
public class InsumoControllerAdvice {

    /** A path identifier that is not a UUID is malformed input (400), not a 500. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> handleMalformedId(MethodArgumentTypeMismatchException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiError(400, "Solicitud invalida", List.of(exception.getName() + " invalido")));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    /** Unknown, inactive, foreign or non-owning supplier (spec disp.R3, design AD7). */
    @ExceptionHandler(ProveedorNoElegibleException.class)
    ResponseEntity<ApiError> handleIneligible(ProveedorNoElegibleException exception) {
        return error(HttpStatus.FORBIDDEN, exception);
    }

    /** Unknown, foreign, resolved, expired or losing offer (spec disp.R3/R4/R5). */
    @ExceptionHandler(OfertaInsumoNoDisponibleException.class)
    ResponseEntity<ApiError> handleUnavailable(OfertaInsumoNoDisponibleException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    /** Delivery on a request that is not assigned, or a reject on a non-pending offer. */
    @ExceptionHandler(TransicionRequerimientoInvalidaException.class)
    ResponseEntity<ApiError> handleInvalidTransition(TransicionRequerimientoInvalidaException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    @ExceptionHandler(RequerimientoInsumoNoEncontradoException.class)
    ResponseEntity<ApiError> handleNotFound(RequerimientoInsumoNoEncontradoException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
    }
}
