package com.sena.cold_day.core.modules.usuarios.domain.events;

/**
 * Published when a password reset is requested for an active account. The
 * plaintext token is carried here so the (infrastructure) notifier can deliver
 * it; only its hash is persisted.
 */
public record RecuperacionSolicitada(Long usuarioId, String correo, String token) {
}
