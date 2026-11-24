package com.sena.cold_day.core.modules.ot.infrastructure.notification;

import java.util.Map;
import java.util.function.Consumer;

/** Puerto de transporte push hacia FCM: permite probar el adaptador sin red. */
public interface FcmSender {

    /**
     * Envia sin bloquear al llamador. {@code tokenInvalido} se invoca si FCM
     * informa que el token ya no existe (app desinstalada, token rotado).
     */
    void enviar(String token, CanalPush canal, String titulo, String cuerpo, Map<String, String> datos,
            Consumer<String> tokenInvalido);
}
