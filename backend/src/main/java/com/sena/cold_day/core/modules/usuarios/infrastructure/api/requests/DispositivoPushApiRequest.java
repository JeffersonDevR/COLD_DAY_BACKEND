package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Body de {@code POST/DELETE /api/usuarios/me/dispositivos}: token FCM y plataforma. */
public record DispositivoPushApiRequest(
        @NotBlank @Size(max = 512) String token,
        @Pattern(regexp = "ANDROID|IOS|WEB") String plataforma) {
}
