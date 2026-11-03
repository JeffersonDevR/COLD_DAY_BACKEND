package com.sena.cold_day.core.modules.maps.infrastructure.cache;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.maps.domain.model.Ruta;
import com.sena.cold_day.core.modules.maps.infrastructure.config.MapsProperties;

/**
 * Cache en memoria de rutas conduccibles.
 *
 * <p>Cada llamada a Directions se factura por elemento, y el mapa de
 * seguimiento vuelve a pedir la ruta mientras el técnico se mueve. La cache es
 * el guardia de costo de esa operación: dos peticiones con el mismo par
 * origen/destino redondeado no salen a Google, y una respuesta "sin ruta"
 * también se guarda para no repetir una consulta que ya sabemos vacía.
 *
 * <p><b>Clave.</b> Las coordenadas se redondean a 5 decimales (~1 m), muy por
 * debajo del umbral de 200 m con el que el frontend decide pedir otra ruta, así
 * que la cache nunca oculta un desplazamiento real. El modo forma parte de la
 * clave para que una futura ruta a pie no reutilice una de conducción.
 *
 * <p><b>Evicción.</b> Estructura mínima y sin dependencias nuevas: un
 * {@link LinkedHashMap} en orden de inserción. Al acceder se descartan las
 * entradas vencidas y al superar el tope se descarta la más antigua (la primera
 * insertada). No hay barrido en background; con el tope por defecto (200) una
 * purga recorre como máximo 200 claves.
 *
 * <p>Las dos propiedades viven en {@code app.maps.cache-ttl-segundos} y
 * {@code app.maps.cache-max-entradas}; ver {@code application.properties}.
 */
@Component
public class RutaCache {

    /** 5 decimales (~1 m): el mismo punto redondea a una sola clave. */
    private static final double FACTOR_REDONDEO = 100_000.0;

    private final long ttlMs;
    private final int maxEntradas;
    private final Clock reloj;
    private final Map<Key, Entry> entradas = new LinkedHashMap<>();

    @Autowired
    public RutaCache(MapsProperties props) {
        this(Duration.ofSeconds(props.cacheTtlSegundos()).toMillis(), props.cacheMaxEntradas(), Clock.systemUTC());
    }

    /** Seam de test: reloj inyectable para probar vencimiento y evicción. */
    RutaCache(long ttlMs, int maxEntradas, Clock reloj) {
        this.ttlMs = ttlMs;
        this.maxEntradas = maxEntradas;
        this.reloj = reloj;
    }

    /**
     * Busca la clave. Un acierto puede contener un valor vacío: eso significa
     * "sin ruta", que también se cachea (y también ahorra cuota).
     *
     * <p>{@code synchronized} porque {@link LinkedHashMap} no es thread-safe y
     * el caso de uso es un singleton con concurrencia real (varios mapas de
     * seguimiento abiertos a la vez).
     */
    public synchronized Optional<Hit> find(Key key) {
        purgarVencidas(reloj.instant());
        Entry entrada = entradas.get(key);
        return entrada == null ? Optional.empty() : Optional.of(new Hit(entrada.valor()));
    }

    public synchronized void put(Key key, Optional<Ruta> valor) {
        Instant ahora = reloj.instant();
        purgarVencidas(ahora);
        entradas.remove(key);
        if (entradas.size() >= maxEntradas) {
            descartarLaMasAntigua();
        }
        entradas.put(key, new Entry(valor, ahora.plusMillis(ttlMs)));
    }

    /** Entradas vivas; solo para tests y diagnóstico. */
    synchronized int size() {
        purgarVencidas(reloj.instant());
        return entradas.size();
    }

    private void purgarVencidas(Instant ahora) {
        entradas.values().removeIf(entrada -> !entrada.expiraEn().isAfter(ahora));
    }

    private void descartarLaMasAntigua() {
        Iterator<Key> masAntigua = entradas.keySet().iterator();
        if (masAntigua.hasNext()) {
            masAntigua.next();
            masAntigua.remove();
        }
    }

    /** Clave de cache: coordenadas redondeadas + modo. */
    public record Key(long origenLat, long origenLng, long destinoLat, long destinoLng, String modo) {

        /** Redondea a 5 decimales (~1 m) antes de formar la clave. */
        public static Key of(double origenLat, double origenLng, double destinoLat, double destinoLng, String modo) {
            return new Key(redondear(origenLat), redondear(origenLng), redondear(destinoLat), redondear(destinoLng),
                    modo);
        }

        private static long redondear(double valor) {
            return Math.round(valor * FACTOR_REDONDEO);
        }
    }

    /** Acierto de cache: {@code valor} vacío significa "Google no tiene ruta". */
    public record Hit(Optional<Ruta> valor) {
    }

    private record Entry(Optional<Ruta> valor, Instant expiraEn) {
    }
}
