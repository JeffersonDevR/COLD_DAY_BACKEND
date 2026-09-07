package com.sena.cold_day.tecnicos.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.shared.ApiError;
import com.sena.cold_day.tecnicos.internal.domain.exception.NumeroIdentificacionDuplicadoException;
import com.sena.cold_day.tecnicos.internal.domain.exception.TecnicoNoEncontradoException;

/**
 * Module-scoped error handling for the Técnicos API (never global): keeps
 * module exceptions out of other modules and the shared kernel.
 */
@RestControllerAdvice(assignableTypes = TecnicoController.class)
public class TecnicoExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
		List<String> fieldErrors = exception.getBindingResult().getFieldErrors().stream()
				.map(error -> error.getField() + " " + error.getDefaultMessage())
				.toList();
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

	private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
		return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
	}
}
