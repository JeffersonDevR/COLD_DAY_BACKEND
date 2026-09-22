package com.sena.cold_day.core.modules.clientes.infrastructure.api.controllers;

import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteDuplicadoException;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.HabeasDataRequeridoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.shared.errors.ApiError;

@RestControllerAdvice(assignableTypes = ClienteController.class)
public class ClienteControllerAdvice {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    /** The authenticated principal does not resolve to a persisted usuario. */
    @ExceptionHandler(UsuarioNoEncontradoException.class)
    ResponseEntity<ApiError> handleUsuarioNotFound(UsuarioNoEncontradoException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    /** The usuario already owns a client profile. */
    @ExceptionHandler(ClienteDuplicadoException.class)
    ResponseEntity<ApiError> handleDuplicate(ClienteDuplicadoException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    /** Alta de cliente con correo ya registrado. */
    @ExceptionHandler(CorreoDuplicadoException.class)
    ResponseEntity<ApiError> handleCorreoDuplicate(CorreoDuplicadoException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    /** Alta de cliente sin aceptar el tratamiento de datos (Ley 1581). */
    @ExceptionHandler(HabeasDataRequeridoException.class)
    ResponseEntity<ApiError> handleHabeasData(HabeasDataRequeridoException exception) {
        return error(HttpStatus.BAD_REQUEST, exception);
    }

    /** The authenticated principal has no client profile (location endpoint). */
    @ExceptionHandler(ClienteNoEncontradoException.class)
    ResponseEntity<ApiError> handleClienteNotFound(ClienteNoEncontradoException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    /** Race safety net: unique {@code usuario_id} violation maps to 409. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException exception) {
        return error(HttpStatus.CONFLICT, new RuntimeException("Data integrity violation"));
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
    }
}
