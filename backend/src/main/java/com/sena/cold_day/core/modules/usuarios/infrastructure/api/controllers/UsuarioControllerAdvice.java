package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.shared.errors.ApiError;

@RestControllerAdvice(assignableTypes = UsuarioController.class)
public class UsuarioControllerAdvice {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    @ExceptionHandler(UsuarioNoEncontradoException.class)
    ResponseEntity<ApiError> handleNotFound(UsuarioNoEncontradoException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    @ExceptionHandler(CorreoDuplicadoException.class)
    ResponseEntity<ApiError> handleDuplicate(CorreoDuplicadoException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    @ExceptionHandler(CredencialesInvalidasException.class)
    ResponseEntity<ApiError> handleUnauthorized(CredencialesInvalidasException exception) {
        return error(HttpStatus.UNAUTHORIZED, exception);
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
    }
}
