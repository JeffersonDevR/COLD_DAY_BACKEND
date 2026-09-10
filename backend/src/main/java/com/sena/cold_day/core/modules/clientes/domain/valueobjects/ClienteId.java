package com.sena.cold_day.core.modules.clientes.domain.valueobjects;

import java.util.UUID;

public record ClienteId(UUID valor) {
    public static ClienteId nueva(){
        return new ClienteId(UUID.randomUUID());
    }
}
