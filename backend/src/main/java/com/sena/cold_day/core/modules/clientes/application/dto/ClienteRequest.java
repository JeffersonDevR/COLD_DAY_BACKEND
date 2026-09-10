package com.sena.cold_day.core.modules.clientes.application.dto;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.shared.domain.Point;
import jakarta.validation.constraints.NotNull;

public record ClienteRequest(
        @NotNull TipoCliente tipoCliente,
        String calle,
        String ciudad,
        String barrio,
        Point ubicacion
        ) {
}
