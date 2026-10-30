package com.sena.cold_day.core.modules.maps.infrastructure.cache;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.maps.domain.model.Ruta;

/**
 * Spec of the route cache, the cost guard of the billed Directions call. The
 * clock is injected so TTL expiry and eviction are deterministic: no sleeps, no
 * real time.
 */
class RutaCacheTest {

    private static final Instant T0 = Instant.parse("2026-10-30T10:00:00Z");
    private static final Ruta RUTA = new Ruta(1.5, 5.0, "polyline");

    private final RelojDePrueba reloj = new RelojDePrueba(T0);

    @Test
    void aMissIsEmptyAndAPutIsServedWithoutAskingAgain() {
        RutaCache cache = cache(200);
        RutaCache.Key clave = clave();

        assertThat(cache.find(clave)).isEmpty();

        cache.put(clave, Optional.of(RUTA));

        assertThat(cache.find(clave)).isPresent();
        assertThat(cache.find(clave).orElseThrow().valor()).contains(RUTA);
    }

    @Test
    void aCachedNoRouteIsStillAHit() {
        RutaCache cache = cache(200);
        RutaCache.Key clave = clave();

        cache.put(clave, Optional.empty());

        assertThat(cache.find(clave)).isPresent();
        assertThat(cache.find(clave).orElseThrow().valor()).isEmpty();
    }

    @Test
    void theEntryExpiresAfterTheTtl() {
        RutaCache cache = cache(200);
        RutaCache.Key clave = clave();
        cache.put(clave, Optional.of(RUTA));

        reloj.avanzar(Duration.ofSeconds(59));
        assertThat(cache.find(clave)).as("59 s: todavía dentro del TTL").isPresent();

        reloj.avanzar(Duration.ofSeconds(2));
        assertThat(cache.find(clave)).as("61 s: vencida").isEmpty();
        assertThat(cache.size()).isZero();
    }

    @Test
    void anExpiredEntryIsDroppedOnAnyAccess() {
        RutaCache cache = cache(200);
        cache.put(clave(), Optional.of(RUTA));
        reloj.avanzar(Duration.ofSeconds(61));

        // The eviction happens on access, for every access, not only for the
        // expired key: that is what keeps the map bounded without a sweeper.
        assertThat(cache.find(clavePara(8.0, -72.5))).isEmpty();

        assertThat(cache.size()).isZero();
    }

    @Test
    void theOldestEntryIsDroppedWhenTheCapIsReached() {
        RutaCache cache = cache(2);
        RutaCache.Key primera = clavePara(7.1, -72.5);
        RutaCache.Key segunda = clavePara(7.2, -72.5);
        RutaCache.Key tercera = clavePara(7.3, -72.5);

        cache.put(primera, Optional.of(RUTA));
        cache.put(segunda, Optional.of(RUTA));
        cache.put(tercera, Optional.of(RUTA));

        assertThat(cache.size()).isEqualTo(2);
        assertThat(cache.find(primera)).as("la más antigua se descarta").isEmpty();
        assertThat(cache.find(segunda)).isPresent();
        assertThat(cache.find(tercera)).isPresent();
    }

    @Test
    void coordinatesRoundToFiveDecimals() {
        // ~1 m of difference: the same cache entry.
        assertThat(RutaCache.Key.of(7.893901, -72.507801, 8.0, -72.5, Ruta.MODO_CONDUCCION))
                .isEqualTo(RutaCache.Key.of(7.893904, -72.507804, 8.0, -72.5, Ruta.MODO_CONDUCCION));
        // 5 decimals apart: a different entry, so no route is served for a
        // moved origin.
        assertThat(RutaCache.Key.of(7.8939, -72.5078, 8.0, -72.5, Ruta.MODO_CONDUCCION))
                .isNotEqualTo(RutaCache.Key.of(7.8940, -72.5078, 8.0, -72.5, Ruta.MODO_CONDUCCION));
    }

    @Test
    void theModeIsPartOfTheKey() {
        assertThat(RutaCache.Key.of(7.8, -72.5, 8.0, -72.5, Ruta.MODO_CONDUCCION))
                .isNotEqualTo(RutaCache.Key.of(7.8, -72.5, 8.0, -72.5, "walking"));
    }

    private RutaCache cache(int maxEntradas) {
        return new RutaCache(Duration.ofSeconds(60).toMillis(), maxEntradas, reloj);
    }

    private static RutaCache.Key clave() {
        return clavePara(7.8, -72.5);
    }

    private static RutaCache.Key clavePara(double origenLat, double origenLng) {
        return RutaCache.Key.of(origenLat, origenLng, 8.0, -72.5, Ruta.MODO_CONDUCCION);
    }

    /** Clock whose instant moves only when the test says so. */
    private static final class RelojDePrueba extends Clock {

        private Instant ahora;

        private RelojDePrueba(Instant ahora) {
            this.ahora = ahora;
        }

        private void avanzar(Duration delta) {
            ahora = ahora.plus(delta);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zona) {
            return this;
        }

        @Override
        public Instant instant() {
            return ahora;
        }
    }
}
