package com.sena.cold_day.core.modules.usuarios.infrastructure.mail;

/** Asunto y texto de la invitación, iguales para todos los transportes. */
final class CorreoDeInvitacion {

    static final String ASUNTO = "Te crearon una cuenta en COLD DAY";

    private CorreoDeInvitacion() {
    }

    static String cuerpo(String enlace) {
        return """
                Hola,
                Te crearon una cuenta para el panel de COLD DAY con este correo.
                Pon tu contraseña en este enlace (vigente por 30 minutos):
                %s
                Si venció, usa «Recuperar contraseña» en la pantalla de ingreso.
                """.formatted(enlace);
    }
}
