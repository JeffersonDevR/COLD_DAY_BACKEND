package com.sena.cold_day.core.modules.usuarios.application.dto;

import java.time.Instant;

/** Result of CU-02: freshly issued JWT with its expiry and the user's rol. */
public record TokenResponse(String token, Instant expiracion, String rol) {
}
