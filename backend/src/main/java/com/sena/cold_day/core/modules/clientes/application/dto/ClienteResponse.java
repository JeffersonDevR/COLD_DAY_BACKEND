package com.sena.cold_day.core.modules.clientes.application.dto;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
public record ClienteResponse(
        ClienteId id,
        UsuarioId usuarioId,
        String nombre,
        String correo,
        String telefono,
        String fotoUrl,
        TipoCliente tipoCliente,
        DireccionPrincipal direccion,
        boolean activo
) {
}
