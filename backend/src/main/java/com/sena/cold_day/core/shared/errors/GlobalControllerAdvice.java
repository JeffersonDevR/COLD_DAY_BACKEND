package com.sena.cold_day.core.shared.errors;

import java.sql.SQLTransientConnectionException;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.persistence.OptimisticLockException;

/**
 * Mapeo global de fallos de infraestructura: pool de conexiones agotado,
 * bloqueo optimista y violacion de restricciones. Sin este advice esas
 * excepciones llegan al manejo por defecto de Spring y se convierten en un 500
 * opaco que le miente al cliente y a los tableros de error: no se distingue
 * "el codigo se rompio" de "el servicio esta saturado".
 *
 * <p>{@code @Order(Ordered.LOWEST_PRECEDENCE)} es obligatorio y load-bearing.
 * Los advices de modulo (Cliente, Proveedor, Tecnico) ya mapean
 * {@link DataIntegrityViolationException} con su propio mensaje y deben seguir
 * ganando para sus controladores. Este advice es la ultima red de seguridad,
 * no el primero en responder, por eso se registra al final del orden.
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class GlobalControllerAdvice {

    private static final Logger log = LoggerFactory.getLogger(GlobalControllerAdvice.class);

    private static final String MENSAJE_CONFLICTO_CONCURRENTE =
            "El recurso fue modificado por otra operacion concurrente. Reintente la operacion.";

    private static final String MENSAJE_CONFLICTO_UNICIDAD =
            "La operacion viola una restriccion de unicidad.";

    private static final String MENSAJE_CAPACIDAD =
            "El servicio no puede atender la solicitud en este momento. Reintente en unos segundos.";

    private static final String MENSAJE_TIEMPO_AGOTADO =
            "La operacion excedio el tiempo de espera. Reintente la operacion.";

    private static final String RETRY_AFTER_SEGUNDOS = "5";

    /**
     * Bloqueo optimista perdido: dos transacciones leyeron la misma fila con
     * {@code @Version} y una escribio primero. No es un bug de codigo sino un
     * conflicto real de concurrencia: 409, nunca 500. Se cubre la variante JPA
     * y toda la familia Spring de bloqueo optimista.
     */
    @ExceptionHandler({
            OptimisticLockException.class,
            OptimisticLockingFailureException.class,
            ObjectOptimisticLockingFailureException.class,
    })
    ResponseEntity<ApiError> handleConflictoConcurrente(Exception exception) {
        return error(HttpStatus.CONFLICT, MENSAJE_CONFLICTO_CONCURRENTE, exception);
    }

    /**
     * Violacion de integridad (unicidad o cualquier otra restriccion). Los
     * modulos que ya la mapean con su propio mensaje conservan su handler; esta
     * rama cubre a los modulos que aun no la mapean. El mensaje es generico a
     * proposito: nunca se devuelve el SQL ni el nombre de la restriccion, que
     * son detalle interno de la base de datos.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleIntegridad(DataIntegrityViolationException exception) {
        return error(HttpStatus.CONFLICT, MENSAJE_CONFLICTO_UNICIDAD, exception);
    }

    /**
     * Falta de capacidad: el pool no entrega conexion, la conexion se perdio o
     * la base esta saturada. Es un 503 (servidor sin capacidad), no un 429
     * (cliente que abusa): confundirlos invierte la senal para los tableros. Se
     * anuncia un reintento corto mediante {@code Retry-After}.
     */
    @ExceptionHandler({
            CannotGetJdbcConnectionException.class,
            DataAccessResourceFailureException.class,
            SQLTransientConnectionException.class,
    })
    ResponseEntity<ApiError> handleCapacidad(Exception exception) {
        return capacidad(exception);
    }

    /** La consulta excedio su tiempo limite: 504. */
    @ExceptionHandler(QueryTimeoutException.class)
    ResponseEntity<ApiError> handleTiempoAgotado(QueryTimeoutException exception) {
        registrar(HttpStatus.GATEWAY_TIMEOUT, exception);
        return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                .body(cuerpo(HttpStatus.GATEWAY_TIMEOUT, MENSAJE_TIEMPO_AGOTADO));
    }

    /**
     * Ultima red de la familia DAO: cualquier {@link DataAccessException} que
     * ningun handler mas especifico haya reclamado se trata como falta de
     * capacidad. Preferimos un 503 honesto a un 500 mudo.
     */
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> handleDataAccess(DataAccessException exception) {
        return capacidad(exception);
    }

    private ResponseEntity<ApiError> capacidad(Exception exception) {
        registrar(HttpStatus.SERVICE_UNAVAILABLE, exception);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header(HttpHeaders.RETRY_AFTER, RETRY_AFTER_SEGUNDOS)
                .body(cuerpo(HttpStatus.SERVICE_UNAVAILABLE, MENSAJE_CAPACIDAD));
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String message, Exception exception) {
        registrar(status, exception);
        return ResponseEntity.status(status).body(cuerpo(status, message));
    }

    private ApiError cuerpo(HttpStatus status, String message) {
        return new ApiError(status.value(), message, List.of());
    }

    /**
     * El detalle completo (SQL, host, stack trace) queda en los logs del
     * operador; el cliente solo recibe un mensaje estable y sin fugas. Loguear
     * en error mantiene la observabilidad sin exponer la infraestructura.
     */
    private void registrar(HttpStatus status, Exception exception) {
        log.error("Fallo de infraestructura mapeado a HTTP {}", status.value(), exception);
    }
}
