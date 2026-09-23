package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.MotivoRequeridoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TransicionOtInvalidaException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.shared.errors.ApiError;

@RestControllerAdvice(assignableTypes = { OtController.class, TarifaController.class })
public class OtControllerAdvice {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    /** The requested OT does not exist. */
    @ExceptionHandler(OtNoEncontradoException.class)
    ResponseEntity<ApiError> handleNotFound(OtNoEncontradoException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    /** The authenticated principal has no client profile. */
    @ExceptionHandler(ClienteNoEncontradoException.class)
    ResponseEntity<ApiError> handleClienteNotFound(ClienteNoEncontradoException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    /** The authenticated principal has no active technician profile. */
    @ExceptionHandler(PerfilTecnicoNoEncontradoException.class)
    ResponseEntity<ApiError> handlePerfilTecnicoNotFound(PerfilTecnicoNoEncontradoException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    /** Illegal state-machine transition (design D1): conflict, state unchanged. */
    @ExceptionHandler(TransicionOtInvalidaException.class)
    ResponseEntity<ApiError> handleIllegalTransition(TransicionOtInvalidaException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    /** Authenticated but not the assigned technician / not the owning client. */
    @ExceptionHandler({ TecnicoNoAsignadoException.class, OtAccesoNoPermitidoException.class })
    ResponseEntity<ApiError> handleForbidden(RuntimeException exception) {
        return error(HttpStatus.FORBIDDEN, exception);
    }

    /** Cancellation without the mandatory reason. */
    @ExceptionHandler(MotivoRequeridoException.class)
    ResponseEntity<ApiError> handleMotivoRequerido(MotivoRequeridoException exception) {
        return error(HttpStatus.BAD_REQUEST, exception);
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
    }
}
