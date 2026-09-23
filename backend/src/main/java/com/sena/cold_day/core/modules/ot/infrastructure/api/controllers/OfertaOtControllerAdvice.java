package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.ot.domain.exception.ConteoAuxiliaresInvalidoException;
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

    /**
     * Ill-typed accept body (aux.S2.2): a non-integer auxiliar count cannot be
     * bound at all, so it is a 400 with the canonical shape and no acceptance.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiError(400, "Solicitud invalida", List.of("cuerpo de la solicitud ilegible")));
    }

    /** Auxiliar count outside {@code [0, app.auxiliares.max]} (aux.R2). */
    @ExceptionHandler(ConteoAuxiliaresInvalidoException.class)
    ResponseEntity<ApiError> handleInvalidAuxiliares(ConteoAuxiliaresInvalidoException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiError(400, "Solicitud invalida", List.of(exception.getMessage())));
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
