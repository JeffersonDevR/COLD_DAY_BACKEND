package com.sena.cold_day.core.modules.usuarios.domain.exception;

/**
 * Puerta T4.3: la adopcion self-service de un perfil solo esta permitida a
 * quien se registro como tecnico. El resto debe pedir el cambio al
 * administrador. El mensaje es para el usuario, no detalle de infraestructura.
 */
public class PerfilNoAdquiribleException extends RuntimeException {

    public PerfilNoAdquiribleException() {
        super("Solo quien se registró como técnico puede cambiar de perfil por su cuenta. "
                + "Para solicitar el cambio, envía una solicitud de cambio de perfil al administrador.");
    }
}
