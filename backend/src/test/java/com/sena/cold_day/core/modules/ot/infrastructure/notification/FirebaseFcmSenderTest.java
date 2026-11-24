package com.sena.cold_day.core.modules.ot.infrastructure.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import com.google.firebase.ErrorCode;
import com.google.firebase.messaging.FirebaseMessagingException;

class FirebaseFcmSenderTest {

    @Test
    void describirFalloIncluyeElCodigoHttpYElMensajeDeGoogleCuandoNoHayCodigoFcm() {
        FirebaseMessagingException error = mock(FirebaseMessagingException.class);
        when(error.getErrorCode()).thenReturn(ErrorCode.PERMISSION_DENIED);
        when(error.getMessage()).thenReturn("Firebase Cloud Messaging API has not been used in project cold-day");

        String descripcion = FirebaseFcmSender.describirFallo(error);

        assertThat(descripcion)
                .contains("FirebaseMessagingException")
                .contains("PERMISSION_DENIED")
                .contains("Firebase Cloud Messaging API has not been used");
    }

    @Test
    void describirFalloAcotaElMensajeLargo() {
        FirebaseMessagingException error = mock(FirebaseMessagingException.class);
        when(error.getErrorCode()).thenReturn(ErrorCode.UNKNOWN);
        when(error.getMessage()).thenReturn("x".repeat(2000));

        assertThat(FirebaseFcmSender.describirFallo(error).length()).isLessThan(400);
    }

    @Test
    void describirFalloDeUnErrorGenericoUsaSuClaseYSuCausa() {
        Throwable error = new RuntimeException("sin red", new java.io.IOException("timeout"));

        assertThat(FirebaseFcmSender.describirFallo(error))
                .contains("RuntimeException")
                .contains("IOException");
    }

    @Test
    void describirFalloAguantaUnMensajeNulo() {
        assertThat(FirebaseFcmSender.describirFallo(new IllegalStateException())).contains("IllegalStateException");
    }
}
