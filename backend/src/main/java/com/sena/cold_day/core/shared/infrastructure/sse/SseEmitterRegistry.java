package com.sena.cold_day.core.shared.infrastructure.sse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * In-memory registry of live SSE emitters, keyed by a logical stream key (for
 * an OT stream, the OT id as a string).
 *
 * <p>The registry owns emitter creation so the removal callbacks cannot be
 * forgotten: an emitter that completes, times out or errors is always dropped.
 * Missing one of those callbacks is the classic SSE leak that accumulates dead
 * connections until the instance dies.
 *
 * <p>A heartbeat keeps idle streams alive through intermediaries. Publishing
 * iterates over a snapshot so an emitter removed concurrently is not a
 * problem.
 */
@Component
public class SseEmitterRegistry {

    private final Map<String, Set<SseEmitter>> emisores = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final long emitterTimeoutMs;

    public SseEmitterRegistry(ObjectMapper objectMapper,
            @Value("${app.sse.emitter-timeout-ms:1800000}") long emitterTimeoutMs) {
        this.objectMapper = objectMapper;
        this.emitterTimeoutMs = emitterTimeoutMs;
    }

    /**
     * Creates an emitter, wires the three removal callbacks and registers it
     * under {@code key}. Callers must use this factory (not a bare
     * {@code new SseEmitter()}) so the callbacks are never missing.
     */
    public SseEmitter crear(String key) {
        SseEmitter emitter = nuevoEmitter();
        emitter.onCompletion(() -> remover(key, emitter));
        emitter.onTimeout(() -> remover(key, emitter));
        emitter.onError(throwable -> remover(key, emitter));
        emisores.computeIfAbsent(key, ignored -> ConcurrentHashMap.newKeySet()).add(emitter);
        return emitter;
    }

    /** Overridable seam so tests can observe the wiring with a fake emitter. */
    protected SseEmitter nuevoEmitter() {
        return new SseEmitter(emitterTimeoutMs);
    }

    /** Sends a named event with a JSON-serialised payload to every emitter. */
    public void publicar(String key, String eventName, Object payload) {
        Set<SseEmitter> bucket = emisores.get(key);
        if (bucket == null || bucket.isEmpty()) {
            return;
        }
        String json = serializar(payload);
        // Snapshot: an emitter may be removed (or its connection die) while iterating.
        for (SseEmitter emitter : new ArrayList<>(bucket)) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(json));
            } catch (IOException | IllegalStateException ex) {
                // A dead connection must not stop the others.
                remover(key, emitter);
            }
        }
    }

    /** Removes an emitter; drops the key entirely once its last emitter is gone. */
    public void remover(String key, SseEmitter emitter) {
        Set<SseEmitter> bucket = emisores.get(key);
        if (bucket == null) {
            return;
        }
        bucket.remove(emitter);
        if (bucket.isEmpty()) {
            emisores.remove(key, bucket);
        }
    }

    /** Completes and drops every emitter. Used on shutdown and by tests. */
    public void limpiar() {
        for (Set<SseEmitter> bucket : emisores.values()) {
            for (SseEmitter emitter : new ArrayList<>(bucket)) {
                try {
                    emitter.complete();
                } catch (RuntimeException ignored) {
                    // The completion callback (or the final clear) removes it anyway.
                }
            }
        }
        emisores.clear();
    }

    /** Number of live emitters under {@code key}. */
    public int contar(String key) {
        Set<SseEmitter> bucket = emisores.get(key);
        return bucket == null ? 0 : bucket.size();
    }

    /** Total number of live emitters; zero means nothing is leaking. */
    public int total() {
        return emisores.values().stream().mapToInt(Set::size).sum();
    }

    String serializar(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JacksonException ex) {
            throw new IllegalStateException("Could not serialise the SSE payload", ex);
        }
    }

    /**
     * Sends a comment line to every live emitter so proxies do not close an
     * idle stream. Dead emitters are dropped as they are discovered.
     */
    @Scheduled(fixedDelayString = "${app.sse.heartbeat-ms:15000}")
    public void latido() {
        for (Map.Entry<String, Set<SseEmitter>> entry : emisores.entrySet()) {
            for (SseEmitter emitter : new ArrayList<>(entry.getValue())) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (IOException | IllegalStateException ex) {
                    remover(entry.getKey(), emitter);
                }
            }
        }
    }
}
