package com.sena.cold_day.core.shared.infrastructure.sse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import tools.jackson.databind.ObjectMapper;

/**
 * Unit tests for the emitter registry. A fake emitter exposes the callbacks the
 * registry wires, so the test proves an emitter is removed on completion,
 * timeout and error (the classic SSE leak) without a servlet container.
 */
class SseEmitterRegistryTest {

    private final RegistroFake registro = new RegistroFake();

    @Test
    void createRegistersTheEmitterUnderTheKey() {
        registro.crear("ot-1");

        assertThat(registro.contar("ot-1")).isEqualTo(1);
        assertThat(registro.total()).isEqualTo(1);
    }

    @Test
    void completionRemovesTheEmitter() {
        FakeSseEmitter emitter = (FakeSseEmitter) registro.crear("ot-1");

        emitter.dispararCompletion();

        assertThat(registro.contar("ot-1")).isZero();
        assertThat(registro.total()).isZero();
    }

    @Test
    void timeoutRemovesTheEmitter() {
        FakeSseEmitter emitter = (FakeSseEmitter) registro.crear("ot-1");

        emitter.dispararTimeout();

        assertThat(registro.contar("ot-1")).isZero();
    }

    @Test
    void errorRemovesTheEmitter() {
        FakeSseEmitter emitter = (FakeSseEmitter) registro.crear("ot-1");

        emitter.dispararError();

        assertThat(registro.contar("ot-1")).isZero();
    }

    @Test
    void publishSendsToEveryEmitterUnderTheKey() {
        FakeSseEmitter primero = (FakeSseEmitter) registro.crear("ot-1");
        FakeSseEmitter segundo = (FakeSseEmitter) registro.crear("ot-1");

        registro.publicar("ot-1", "ot-estado-cambiado", Map.of("destino", "EN_CAMINO"));

        assertThat(primero.envios).isEqualTo(1);
        assertThat(segundo.envios).isEqualTo(1);
    }

    @Test
    void publishDropsTheFailingEmitterWithoutAffectingTheOthers() {
        FakeSseEmitter muerto = (FakeSseEmitter) registro.crear("ot-1");
        FakeSseEmitter vivo = (FakeSseEmitter) registro.crear("ot-1");
        muerto.fallarAlEnviar = true;

        registro.publicar("ot-1", "ot-estado-cambiado", Map.of("destino", "EN_CAMINO"));

        assertThat(vivo.envios).isEqualTo(1);
        assertThat(registro.contar("ot-1")).isEqualTo(1);
    }

    @Test
    void publishOnAnUnknownKeyIsANoOp() {
        assertThatCode(() -> registro.publicar("nadie", "evt", Map.of())).doesNotThrowAnyException();
    }

    @Test
    void heartbeatPingsLiveEmittersAndDropsDeadOnes() {
        FakeSseEmitter vivo = (FakeSseEmitter) registro.crear("ot-1");
        FakeSseEmitter muerto = (FakeSseEmitter) registro.crear("ot-2");
        muerto.fallarAlEnviar = true;

        registro.latido();

        assertThat(vivo.envios).isEqualTo(1);
        assertThat(registro.contar("ot-2")).isZero();
    }

    @Test
    void limpiarDropsEverything() {
        registro.crear("ot-1");
        registro.crear("ot-2");

        registro.limpiar();

        assertThat(registro.total()).isZero();
    }

    @Test
    void serializarProducesJson() {
        assertThat(registro.serializar(Map.of("destino", "EN_CAMINO"))).contains("\"destino\":\"EN_CAMINO\"");
    }

    /** Registry whose factory hands out {@link FakeSseEmitter}s. */
    private static final class RegistroFake extends SseEmitterRegistry {

        private RegistroFake() {
            super(new ObjectMapper(), 60_000L);
        }

        @Override
        protected SseEmitter nuevoEmitter() {
            return new FakeSseEmitter();
        }
    }

    /** Emitter that records the callbacks and the send calls instead of writing. */
    private static final class FakeSseEmitter extends SseEmitter {

        private Runnable onCompletion;
        private Runnable onTimeout;
        private Consumer<Throwable> onError;
        private int envios;
        private boolean fallarAlEnviar;

        private FakeSseEmitter() {
            super(60_000L);
        }

        @Override
        public void onCompletion(Runnable callback) {
            this.onCompletion = callback;
        }

        @Override
        public void onTimeout(Runnable callback) {
            this.onTimeout = callback;
        }

        @Override
        public void onError(Consumer<Throwable> callback) {
            this.onError = callback;
        }

        @Override
        public void send(SseEventBuilder builder) throws IOException {
            if (fallarAlEnviar) {
                throw new IOException("connection closed");
            }
            envios++;
        }

        private void dispararCompletion() {
            onCompletion.run();
        }

        private void dispararTimeout() {
            onTimeout.run();
        }

        private void dispararError() {
            onError.accept(new IOException("boom"));
        }
    }
}
