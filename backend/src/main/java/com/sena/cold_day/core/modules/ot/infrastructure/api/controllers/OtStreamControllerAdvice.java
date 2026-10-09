package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import java.util.List;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.shared.errors.ApiError;
import com.sena.cold_day.core.shared.infrastructure.sse.TicketSseInvalidoException;

/**
 * Error mapping for the OT SSE stream only.
 *
 * <p>The stream is anonymous at the filter chain (the ticket is the
 * credential), so the errors it raises must be mapped here instead of relying
 * on the security chain: without this advice an invalid ticket would surface as
 * a 500, and a valid ticket belonging to a non-participant would be answered as
 * an anonymous 401 rather than a 403.
 */
@RestControllerAdvice(assignableTypes = OtStreamController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class OtStreamControllerAdvice {

    @ExceptionHandler(TicketSseInvalidoException.class)
    ResponseEntity<ApiError> handleTicket(TicketSseInvalidoException exception) {
        return json(HttpStatus.UNAUTHORIZED, exception.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> handleDenied(AccessDeniedException exception) {
        return json(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    @ExceptionHandler(OtNoEncontradoException.class)
    ResponseEntity<ApiError> handleNotFound(OtNoEncontradoException exception) {
        return json(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    /**
     * Always JSON, even when the client asked for {@code text/event-stream}:
     * the error body must not be negotiated into the stream media type.
     */
    private ResponseEntity<ApiError> json(HttpStatus status, String message) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON)
                .body(new ApiError(status.value(), message, List.of()));
    }
}
