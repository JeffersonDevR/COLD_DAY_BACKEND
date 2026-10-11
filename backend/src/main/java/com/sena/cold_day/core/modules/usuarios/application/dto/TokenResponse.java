package com.sena.cold_day.core.modules.usuarios.application.dto;

import java.time.Instant;
import java.util.List;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/**
 * Result of CU-02: freshly issued JWT with its expiry, the primary {@code rol}
 * (display/back-compat) and the expanded {@code roles} set (Option C).
 */
public record TokenResponse(String token, Instant expiracion, String rol, List<Rol> roles) {
}
