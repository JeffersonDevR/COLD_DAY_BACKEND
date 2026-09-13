package com.sena.cold_day.core.modules.usuarios.application.dto;

public record RestablecerContrasenaRequest(String token, String nuevaPassword) {
}
