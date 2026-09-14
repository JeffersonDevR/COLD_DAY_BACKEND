package com.sena.cold_day.core.modules.tecnicos.domain.exception;

/**
 * The authenticated principal is a usuario without an active technician
 * profile. The {@code me} location endpoint resolves the profile by usuario.
 */
public class PerfilTecnicoNoEncontradoException extends RuntimeException {

    public PerfilTecnicoNoEncontradoException(Long usuarioId) {
        super("No existe un perfil de tecnico para el usuario: " + usuarioId);
    }
}
