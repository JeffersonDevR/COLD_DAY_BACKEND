package com.sena.cold_day.core.modules.usuarios.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Password-recovery mail transport configuration (prefix {@code app.mail},
 * WS8/M10). Every sensitive value (host, credentials) is supplied by environment
 * through the placeholders declared in {@code application.properties}; nothing
 * here has a hard-coded secret.
 *
 * <p>Fail-fast contract: a <em>disabled</em> transport may ship with no
 * credentials (dev/test use the logging fallback), but enabling it without
 * {@code host}, {@code from} or credentials aborts startup instead of silently
 * dropping every recovery token. This mirrors the prod-only property convention
 * (missing sensitive placeholders fail at startup).
 */
@ConfigurationProperties(prefix = "app.mail")
public record MailProperties(boolean enabled, String host, int port, String username, String password,
        String from, boolean tls, String resetUrlBase, boolean logToken) {

    /** SMTP submission port used when none is configured. */
    public static final int PUERTO_POR_DEFECTO = 587;

    /** Local frontend route used to build the reset link when none is set. */
    public static final String RESET_URL_BASE_POR_DEFECTO = "http://localhost:4200/recuperar";

    public MailProperties {
        host = normalizar(host);
        username = normalizar(username);
        password = normalizar(password);
        from = normalizar(from);
        if (port <= 0) {
            port = PUERTO_POR_DEFECTO;
        }
        if (resetUrlBase == null || resetUrlBase.isBlank()) {
            resetUrlBase = RESET_URL_BASE_POR_DEFECTO;
        }
        if (enabled) {
            exigirPresente(host, "app.mail.host");
            exigirPresente(from, "app.mail.from");
            exigirPresente(username, "app.mail.username");
            exigirPresente(password, "app.mail.password");
        }
    }

    /** True when the SMTP transport is enabled and fully configured. */
    public boolean usable() {
        return enabled && !host.isBlank() && !from.isBlank() && !username.isBlank() && !password.isBlank();
    }

    /**
     * Reset link handed to the user. The token is carried as a query parameter so
     * the frontend can route straight to the reset step.
     */
    public String enlaceDeRecuperacion(String token) {
        String separador = resetUrlBase.contains("?") ? "&" : "?";
        return resetUrlBase + separador + "token=" + token;
    }

    private static String normalizar(String valor) {
        return valor == null ? "" : valor.trim();
    }

    private static void exigirPresente(String valor, String propiedad) {
        if (valor == null || valor.isBlank()) {
            throw new IllegalStateException("Configuracion de correo incompleta: falta " + propiedad
                    + " con app.mail.enabled=true. Define " + propiedad + " o desactiva el transporte de correo.");
        }
    }
}
