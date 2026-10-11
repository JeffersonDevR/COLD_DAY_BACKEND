package com.sena.cold_day.core.modules.tecnicos.domain.exception;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Thrown when an existing usuario already owns a technician profile. A usuario
 * may hold at most one {@code Tecnico} (unique {@code usuario_id}). Detected by
 * any technician row, active or not, so a soft-deleted profile still blocks a
 * duplicate acquisition.
 */
public class TecnicoDuplicadoException extends RuntimeException {

    public TecnicoDuplicadoException(UsuarioId usuarioId) {
        super("El usuario ya tiene un perfil de tecnico: " + usuarioId.valor());
    }
}
