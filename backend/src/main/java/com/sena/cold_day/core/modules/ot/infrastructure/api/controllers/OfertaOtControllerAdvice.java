package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.ot.domain.exception.OfertaExpiradaException;
import com.sena.cold_day.core.modules.ot.domain.exception.OfertaNoDisponibleException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoValidadoException;
import com.sena.cold_day.core.shared.errors.ApiError;

/**
 * Error mapping for the dispatch-offer surface. Both the expired offer and the
 * cross-offer loser are conflicts (design D5/D6); a technician that cannot
 * operate is a 403 and an unknown resource is a 404.
 */
@RestControllerAdvice(assignableTypes = OfertaOtController.class)
public class OfertaOtControllerAdvice {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    /** Offer expired lazily (design D6): the accept is rejected, the OT is unaffected. */
    @ExceptionHandler(OfertaExpiradaException.class)
    ResponseEntity<ApiError> handleExpired(OfertaExpiradaException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    /** Cross-offer loser or an offer that is not the technician's own (design D5). */
    @ExceptionHandler(OfertaNoDisponibleException.class)
    ResponseEntity<ApiError> handleUnavailable(OfertaNoDisponibleException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    @ExceptionHandler({ OtNoEncontradoException.class, TecnicoNoEncontradoException.class,
            PerfilTecnicoNoEncontradoException.class })
    ResponseEntity<ApiError> handleNotFound(RuntimeException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    /** Not approved / already busy: cannot take an order (business rule, 403). */
    @ExceptionHandler({ TecnicoNoValidadoException.class, TecnicoAsignadoException.class })
    ResponseEntity<ApiError> handleCannotOperate(RuntimeException exception) {
        return error(HttpStatus.FORBIDDEN, exception);
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
    }
}
