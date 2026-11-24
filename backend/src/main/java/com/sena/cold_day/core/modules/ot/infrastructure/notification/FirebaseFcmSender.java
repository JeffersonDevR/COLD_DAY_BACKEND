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
                log.warn("Fallo el envio push: {}", describirFallo(error));
            }
        }, MoreExecutors.directExecutor());
    }

    private static final int MAX_MENSAJE = 300;

    /**
     * Descripcion diagnostica del fallo: sin el codigo FCM (null en errores de
     * autenticacion o de API deshabilitada) el unico dato util es el codigo de
     * error de Google y su mensaje (p. ej. PERMISSION_DENIED + "API not enabled").
     * El mensaje se acota; el token y el cuerpo del push nunca entran aqui.
     */
    static String describirFallo(Throwable error) {
        StringBuilder texto = new StringBuilder(error.getClass().getSimpleName());
        if (error instanceof FirebaseMessagingException fme) {
            texto.append(" errorCode=").append(fme.getErrorCode())
                    .append(" fcmCode=").append(fme.getMessagingErrorCode());
        }
        String mensaje = error.getMessage();
        if (mensaje != null && !mensaje.isBlank()) {
            texto.append(" mensaje=").append(
                    mensaje.length() > MAX_MENSAJE ? mensaje.substring(0, MAX_MENSAJE) + "..." : mensaje);
        }
        Throwable causa = error.getCause();
        if (causa != null) {
            texto.append(" causa=").append(causa.getClass().getSimpleName());
        }
        return texto.toString();
    }
}
