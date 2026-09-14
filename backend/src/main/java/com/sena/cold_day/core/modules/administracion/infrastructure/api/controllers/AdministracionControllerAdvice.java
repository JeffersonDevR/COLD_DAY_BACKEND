package com.sena.cold_day.core.modules.administracion.infrastructure.api.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.administracion.domain.exception.AdministracionConflictoException;
import com.sena.cold_day.core.modules.administracion.domain.exception.DisputaNoEncontradaException;
import com.sena.cold_day.core.modules.administracion.domain.exception.LiquidacionNoEncontradaException;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.MotivoRequeridoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TransicionOtInvalidaException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.shared.errors.ApiError;

@RestControllerAdvice(assignableTypes = { AdminController.class, LiquidacionController.class,
        DisputaController.class })
public class AdministracionControllerAdvice {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError(400, "Solicitud invalida", errors));
    }

    @ExceptionHandler({ LiquidacionNoEncontradaException.class, DisputaNoEncontradaException.class,
            OtNoEncontradoException.class, ClienteNoEncontradoException.class,
            PerfilTecnicoNoEncontradoException.class, TecnicoNoEncontradoException.class })
    ResponseEntity<ApiError> handleNotFound(RuntimeException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }

    /** Regla de negocio violada (pago duplicado, disputa duplicada, OT no finalizada). */
    @ExceptionHandler(AdministracionConflictoException.class)
    ResponseEntity<ApiError> handleConflicto(AdministracionConflictoException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    /** Transicion ilegal de la maquina de estados (diseño D1): conflicto, sin cambios. */
    @ExceptionHandler({ TransicionOtInvalidaException.class, IllegalStateException.class })
    ResponseEntity<ApiError> handleIllegalTransition(RuntimeException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }

    /** Principal autenticado pero sin titularidad (ni tecnico asignado ni cliente dueño). */
    @ExceptionHandler({ TecnicoNoAsignadoException.class, OtAccesoNoPermitidoException.class,
            TecnicoAsignadoException.class })
    ResponseEntity<ApiError> handleForbidden(RuntimeException exception) {
        return error(HttpStatus.FORBIDDEN, exception);
    }

    /** Motivo obligatorio ausente. */
    @ExceptionHandler({ MotivoRequeridoException.class, IllegalArgumentException.class })
    ResponseEntity<ApiError> handleBadRequest(RuntimeException exception) {
        return error(HttpStatus.BAD_REQUEST, exception);
    }

    private ResponseEntity<ApiError> error(HttpStatus status, RuntimeException exception) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), exception.getMessage(), List.of()));
    }
}
