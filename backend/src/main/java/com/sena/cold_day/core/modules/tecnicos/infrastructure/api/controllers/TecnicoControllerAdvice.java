package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.controllers;

import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.shared.errors.ApiError;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.DocumentacionIncompletaException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.NumeroIdentificacionDuplicadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoValidadoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;

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

    @ExceptionHandler(CorreoDuplicadoException.class)
    ResponseEntity<ApiError> handleDuplicateCorreo(CorreoDuplicadoException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    @ExceptionHandler({ UsuarioNoEncontradoException.class })
    ResponseEntity<ApiError> handleUsuarioNotFound(RuntimeException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    /** Not authenticated-enough-to-operate: 403, semantically distinct from 401. */
    @ExceptionHandler(TecnicoNoValidadoException.class)
    ResponseEntity<ApiError> handleNoValidado(TecnicoNoValidadoException exception) {
        return error(HttpStatus.FORBIDDEN, exception);
    }

    @ExceptionHandler(DocumentacionIncompletaException.class)
    ResponseEntity<ApiError> handleDocumentacion(DocumentacionIncompletaException exception) {
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
