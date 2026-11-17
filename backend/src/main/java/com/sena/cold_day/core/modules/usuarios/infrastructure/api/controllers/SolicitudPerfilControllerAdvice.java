package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import java.util.List;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.usuarios.domain.exception.PerfilNoSolicitableException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilDuplicadaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilNoEncontradaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilYaResueltaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.shared.errors.ApiError;

/** Un unico {@link ApiError} por respuesta; nunca {@code List<ApiError>}. */
@RestControllerAdvice(assignableTypes = SolicitudPerfilController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SolicitudPerfilControllerAdvice {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errores = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errores));
    }

    @ExceptionHandler({ UsuarioNoEncontradoException.class, SolicitudPerfilNoEncontradaException.class })
    ResponseEntity<ApiError> handleNotFound(RuntimeException fallo) {
        return error(HttpStatus.NOT_FOUND, fallo);
    }

    @ExceptionHandler({ SolicitudPerfilDuplicadaException.class, SolicitudPerfilYaResueltaException.class })
    ResponseEntity<ApiError> handleConflict(RuntimeException fallo) {
        return error(HttpStatus.CONFLICT, fallo);
    }

    @ExceptionHandler(PerfilNoSolicitableException.class)
    ResponseEntity<ApiError> handlePerfilNoSolicitable(PerfilNoSolicitableException fallo) {
        return error(HttpStatus.BAD_REQUEST, fallo);
    }

    /** Carrera del indice unico parcial: 409 con mensaje estable, sin SQL. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException fallo) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(409, "Ya tienes una solicitud pendiente para ese perfil.", List.of()));
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException fallo) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), fallo.getMessage(), List.of()));
    }
}
