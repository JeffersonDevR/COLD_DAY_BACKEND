package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.proveedores.domain.exception.DocumentacionProveedorIncompletaException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoValidadoException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.TransicionValidacionProveedorInvalidaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.HabeasDataRequeridoException;
import com.sena.cold_day.core.shared.errors.ApiError;

/**
 * Canonical error surface for the supplier admin API, reusing the shared
 * {@code ApiError} shape.
 *
 * <p>A duplicate {@code correo} maps to 409 through {@link CorreoDuplicadoException}.
 * A duplicate {@code nit} is not pre-checked (the design specifies 409 only for
 * correo), so the {@code UNIQUE(nit)} constraint violation is mapped here to 409
 * as well — consistently with correo and never as an unhandled 500. Because the
 * use case is {@code @Transactional}, the violation rolls the whole unit back:
 * no supplier account is half-created.
 */
@RestControllerAdvice(assignableTypes = ProveedorController.class)
public class ProveedorControllerAdvice {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    @ExceptionHandler(CorreoDuplicadoException.class)
    ResponseEntity<ApiError> handleDuplicateCorreo(CorreoDuplicadoException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    @ExceptionHandler(HabeasDataRequeridoException.class)
    ResponseEntity<ApiError> handleHabeasData(HabeasDataRequeridoException exception) {
        return error(HttpStatus.BAD_REQUEST, exception);
    }

    /** Duplicate NIT (or any other integrity violation) is a conflict, not a 500. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(409, "NIT duplicado o dato unico ya registrado", List.of()));
    }

    /**
     * Approving or rejecting a supplier whose documentation is incomplete or
     * expired. This advice already answers 400 for malformed input, so the rule
     * follows the file's own convention rather than introducing 422 here.
     */
    @ExceptionHandler(DocumentacionProveedorIncompletaException.class)
    ResponseEntity<ApiError> handleIncompleteDocumentation(DocumentacionProveedorIncompletaException exception) {
        return error(HttpStatus.BAD_REQUEST, exception);
    }

    /** A validation transition that is not part of the state machine is a conflict. */
    @ExceptionHandler(TransicionValidacionProveedorInvalidaException.class)
    ResponseEntity<ApiError> handleInvalidValidationTransition(
            TransicionValidacionProveedorInvalidaException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    /** Acting while the documentation is not approved. */
    @ExceptionHandler(ProveedorNoValidadoException.class)
    ResponseEntity<ApiError> handleNotValidated(ProveedorNoValidadoException exception) {
        return error(HttpStatus.FORBIDDEN, exception);
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
    }
}
