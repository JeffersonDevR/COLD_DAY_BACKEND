package com.sena.cold_day.core.modules.clientes.domain.exception;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Thrown when an existing usuario already owns a client profile. A usuario may
 * hold at most one {@code Cliente} (unique {@code usuario_id}).
 */
public class ClienteDuplicadoException extends RuntimeException {

    public ClienteDuplicadoException(UsuarioId usuarioId) {
        super("El usuario ya tiene un perfil de cliente: " + usuarioId.valor());
    }
}
