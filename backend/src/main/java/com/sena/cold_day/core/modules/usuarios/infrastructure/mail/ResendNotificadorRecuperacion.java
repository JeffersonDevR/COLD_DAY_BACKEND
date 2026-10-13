package com.sena.cold_day.core.modules.usuarios.infrastructure.mail;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.sena.cold_day.core.modules.usuarios.domain.events.RecuperacionSolicitada;
import com.sena.cold_day.core.modules.usuarios.domain.services.NotificadorRecuperacion;
import com.sena.cold_day.core.modules.usuarios.infrastructure.config.MailProperties;

/**
 * Delivery of password-recovery tokens through Resend's HTTP API. Active only
 * when {@code app.mail.provider=resend}; otherwise the SMTP or logging adapter
 * takes over. Runs from the {@code AFTER_COMMIT} listener, so transport failures
 * are swallowed (and logged), never surfaced to the caller whose request already
 * succeeded: the persisted token hash remains the source of truth.
 */
@Component
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "resend")
public class ResendNotificadorRecuperacion implements NotificadorRecuperacion {

    private static final Logger log = LoggerFactory.getLogger(ResendNotificadorRecuperacion.class);
    private static final URI ENDPOINT = URI.create("https://api.resend.com/emails");
    private static final String API_KEY_ENV = "RESEND_API";

    private final MailProperties propiedades;
    private final String apiKey;
    private final HttpClient client;

    @org.springframework.beans.factory.annotation.Autowired
    public ResendNotificadorRecuperacion(MailProperties propiedades,
            @org.springframework.beans.factory.annotation.Value("${app.mail.resend-api-key:${RESEND_API:}}") String apiKey) {
        this(propiedades, apiKey, HttpClient.newHttpClient());
    }

    public ResendNotificadorRecuperacion(MailProperties propiedades, String apiKey, HttpClient client) {
        this.propiedades = propiedades;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = client == null ? HttpClient.newHttpClient() : client;
    }

    public ResendNotificadorRecuperacion(String apiKey, MailProperties propiedades) {
        this(propiedades, apiKey, HttpClient.newHttpClient());
    }

    public ResendNotificadorRecuperacion(HttpClient client, String apiKey, MailProperties propiedades) {
        this(propiedades, apiKey, client);
    }

    public ResendNotificadorRecuperacion(String apiKey, MailProperties propiedades, HttpClient client) {
        this(propiedades, apiKey, client);
    }

    @Override
    public void notificar(RecuperacionSolicitada evento) {
        if (!StringUtils.hasText(apiKey)) {
            log.warn("Resend provider activo pero sin API key ({}): no se entrega correo de recuperacion", API_KEY_ENV);
            return;
        }
        if (propiedades == null || !StringUtils.hasText(propiedades.from())) {
            log.error("Resend provider activo pero falta app.mail.from; no se entrega correo de recuperacion");
            return;
        }
        String body = """
                {"from":%s,"to":[%s],"subject":%s,"text":%s}
                """.formatted(json(propiedades.from()), json(evento.correo()),
                json("Restablece tu contrasena - COLD DAY"), json(cuerpo(evento)));
        try {
            HttpRequest request = HttpRequest.newBuilder(ENDPOINT)
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.error("No se pudo entregar el correo de recuperacion via Resend: status={} body={}",
                        response.statusCode(), truncate(response.body()));
            }
        } catch (Exception ex) {
            log.error("No se pudo entregar el correo de recuperacion via Resend: usuarioId={}", evento.usuarioId(), ex);
        }
    }

    private String cuerpo(RecuperacionSolicitada evento) {
        return """
                Hola,

                Recibimos una solicitud para restablecer tu contrasena de COLD DAY.
                Abre este enlace (vigente por 30 minutos):

                %s

                Si no solicitaste el cambio, ignora este mensaje.
                """.formatted(propiedades.enlaceDeRecuperacion(evento.token()));
    }

    private static String json(String value) {
        if (value == null) {
            return "null";
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\b", "\\b").replace("\f", "\\f")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
    }

    private static String truncate(String value) {
        if (value == null) {
            return "";
        }
        return value.length() <= 500 ? value : value.substring(0, 500) + "...";
    }
}