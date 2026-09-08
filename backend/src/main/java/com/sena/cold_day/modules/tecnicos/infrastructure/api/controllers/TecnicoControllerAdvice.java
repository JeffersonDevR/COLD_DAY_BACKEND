package com.sena.cold_day.modules.tecnicos.infrastructure.api.controllers;

import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.shared.errors.ApiError;
import com.sena.cold_day.modules.tecnicos.domain.exception.NumeroIdentificacionDuplicadoException;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;

@RestControllerAdvice(assignableTypes = TecnicoController.class)
public class TecnicoControllerAdvice {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    @ExceptionHandler(TecnicoNoEncontradoException.class)
    ResponseEntity<ApiError> handleNotFound(TecnicoNoEncontradoException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    @ExceptionHandler(NumeroIdentificacionDuplicadoException.class)
    ResponseEntity<ApiError> handleDuplicate(NumeroIdentificacionDuplicadoException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException exception) {
        return error(HttpStatus.CONFLICT, new RuntimeException("Data integrity violation"));
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
    }
}
