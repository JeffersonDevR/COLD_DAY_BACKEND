package com.sena.cold_day.core.modules.ot.infrastructure.notification;

import java.util.Map;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.api.core.ApiFutureCallback;
import com.google.api.core.ApiFutures;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;

/** Transporte real: Firebase Admin SDK, envio asincrono (no bloquea el despacho). */
public class FirebaseFcmSender implements FcmSender {

    private static final Logger log = LoggerFactory.getLogger(FirebaseFcmSender.class);

    private final FirebaseMessaging messaging;

    public FirebaseFcmSender(FirebaseMessaging messaging) {
        this.messaging = messaging;
    }

    @Override
    public void enviar(String token, CanalPush canal, String titulo, String cuerpo, Map<String, String> datos,
            Consumer<String> tokenInvalido) {
        Message mensaje = Message.builder()
                .setToken(token)
                .setNotification(Notification.builder().setTitle(titulo).setBody(cuerpo).build())
                .setAndroidConfig(AndroidConfig.builder()
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .setNotification(AndroidNotification.builder().setChannelId(canal.id()).build())
                        .build())
                .putAllData(datos)
                .build();
        ApiFutures.addCallback(messaging.sendAsync(mensaje), new ApiFutureCallback<String>() {
            @Override
            public void onSuccess(String id) {
                log.debug("Push enviado: {}", id);
            }

            @Override
            public void onFailure(Throwable error) {
                if (error instanceof FirebaseMessagingException fme
                        && (fme.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED
                                || fme.getMessagingErrorCode() == MessagingErrorCode.INVALID_ARGUMENT)) {
                    tokenInvalido.accept(token);
                    return;
                }
                // Sin el token ni el cuerpo: no se loguean datos del usuario.
                String codigo = error instanceof FirebaseMessagingException fme
                        ? String.valueOf(fme.getMessagingErrorCode()) : "n/a";
                log.warn("Fallo el envio push: {} codigo={}", error.getClass().getSimpleName(), codigo);
            }
        }, MoreExecutors.directExecutor());
    }
}
