package com.sena.cold_day.core.shared.infrastructure.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Shared time source (design D6). Use cases depend on {@link Clock} instead of
 * {@code Instant.now()} so the 60-second dispatch windows and the 10-minute
 * cancellation window are deterministic in tests ({@code Clock.fixed}) without
 * sleeps.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
