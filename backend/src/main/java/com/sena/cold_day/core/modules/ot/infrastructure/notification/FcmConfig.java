package com.sena.cold_day.core.modules.ot.infrastructure.notification;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Inicializa Firebase solo con {@code app.push.fcm.enabled=true}. La cuenta de
 * servicio llega por variable de entorno (JSON o ruta de archivo), nunca por
 * el repositorio. Si faltan credenciales la app NO arranca: es preferible a
 * creer que hay push cuando no lo hay.
 */
@Configuration
@ConditionalOnProperty(name = "app.push.fcm.enabled", havingValue = "true")
public class FcmConfig {

    @Bean
    FcmSender fcmSender(
            @Value("${app.push.fcm.credentials-json:}") String credencialesJson,
            @Value("${app.push.fcm.credentials-path:}") String credencialesRuta) throws IOException {
        try (InputStream in = abrir(credencialesJson, credencialesRuta)) {
            FirebaseOptions opciones = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(in))
                    .build();
            FirebaseApp app = FirebaseApp.getApps().isEmpty()
                    ? FirebaseApp.initializeApp(opciones)
                    : FirebaseApp.getInstance();
            return new FirebaseFcmSender(FirebaseMessaging.getInstance(app));
        }
    }

    private static InputStream abrir(String json, String ruta) throws IOException {
        if (!json.isBlank()) {
            return new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8));
        }
        if (!ruta.isBlank()) {
            return new FileInputStream(ruta);
        }
        throw new IllegalStateException(
                "FCM_ENABLED=true pero faltan FCM_CREDENTIALS_JSON o FCM_CREDENTIALS_PATH");
    }
}
