package com.sena.cold_day.core.modules.usuarios.infrastructure.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.Flow;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.sena.cold_day.core.modules.usuarios.domain.events.CuentaInternaInvitada;
import com.sena.cold_day.core.modules.usuarios.infrastructure.config.MailProperties;

class ResendNotificadorRecuperacionTest {

    private static final CuentaInternaInvitada INVITACION =
            new CuentaInternaInvitada(7L, "ana@example.com", "TOK-INV");

    @Test
    @SuppressWarnings("unchecked")
    void laInvitacionSaleConSuAsuntoYElEnlace() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(ok);

        new ResendNotificadorRecuperacion(props(), "clave-de-prueba", client).invitar(INVITACION);

        ArgumentCaptor<HttpRequest> enviado = ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).send(enviado.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(cuerpoDe(enviado.getValue()))
                .contains("ana@example.com")
                .contains("Te crearon una cuenta en COLD DAY")
                .contains("https://app.coldday.co/recuperar?token=TOK-INV");
    }

    @Test
    void sinClaveNoIntentaEnviar() {
        HttpClient client = mock(HttpClient.class);

        new ResendNotificadorRecuperacion(props(), "", client).invitar(INVITACION);

        verifyNoInteractions(client);
    }

    private static String cuerpoDe(HttpRequest request) {
        var lector = HttpResponse.BodySubscribers.ofString(StandardCharsets.UTF_8);
        request.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
            public void onSubscribe(Flow.Subscription s) { lector.onSubscribe(s); }
            public void onNext(ByteBuffer parte) { lector.onNext(List.of(parte)); }
            public void onError(Throwable error) { lector.onError(error); }
            public void onComplete() { lector.onComplete(); }
        });
        return lector.getBody().toCompletableFuture().join();
    }

    private static MailProperties props() {
        return new MailProperties(false, "", 0, "", "", "no-reply@coldday.co", true,
                "https://app.coldday.co/recuperar", false);
    }
}
