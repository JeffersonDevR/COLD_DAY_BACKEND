package com.sena.cold_day.core.modules.usuarios.domain.aggregates;

import java.time.Instant;

/** Instalacion de la app que puede recibir push: token FCM + plataforma. */
public record DispositivoPush(Long id, Long usuarioId, String token, String plataforma,
        Instant creadoEn, Instant actualizadoEn) {

    public static DispositivoPush nuevo(Long usuarioId, String token, String plataforma, Instant ahora) {
        return new DispositivoPush(null, usuarioId, token, plataforma, ahora, ahora);
    }

    /** Mismo token, nuevo dueno (otra cuenta inicio sesion en el telefono). */
    public DispositivoPush reasignar(Long nuevoUsuarioId, String nuevaPlataforma, Instant ahora) {
        return new DispositivoPush(id, nuevoUsuarioId, token, nuevaPlataforma, creadoEn, ahora);
    }
}
