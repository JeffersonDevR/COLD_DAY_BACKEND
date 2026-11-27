package com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests;

import jakarta.validation.constraints.NotNull;

public record EstadoCuentaApiRequest(@NotNull Boolean activa) {
}
