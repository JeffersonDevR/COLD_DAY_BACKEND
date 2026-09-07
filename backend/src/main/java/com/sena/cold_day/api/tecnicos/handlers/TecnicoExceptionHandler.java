package com.sena.cold_day.api.tecnicos.handlers;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.support.WebExchangeBindException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.shared.errors.ApiError;
import com.sena.cold_day.modules.tecnicos.domain.exception.NumeroIdentificacionDuplicadoException;
import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.api.tecnicos.controllers.TecnicoController;

@RestControllerAdvice(assignableTypes = TecnicoController.class)
public class TecnicoExceptionHandler {

	@ExceptionHandler(WebExchangeBindException.class)
	ResponseEntity<ApiError> handleValidation(WebExchangeBindException exception) {
		List<String> fieldErrors = exception.getBindingResult().getFieldErrors().stream()
				.map(error -> error.getField() + " " + error.getDefaultMessage())
				.collect(Collectors.toList());
		return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", fieldErrors));
	}

	@ExceptionHandler(TecnicoNoEncontradoException.class)
	ResponseEntity<ApiError> handleNotFound(TecnicoNoEncontradoException exception) {
		return error(HttpStatus.NOT_FOUND, exception);
	}

	@ExceptionHandler(NumeroIdentificacionDuplicadoException.class)
	ResponseEntity<ApiError> handleDuplicate(NumeroIdentificacionDuplicadoException exception) {
		return error(HttpStatus.CONFLICT, exception);
	}

	@ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
	ResponseEntity<ApiError> handleDataIntegrity(org.springframework.dao.DataIntegrityViolationException exception) {
		return error(HttpStatus.CONFLICT, new RuntimeException("Data integrity violation"));
	}

	private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
		return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
	}
}
