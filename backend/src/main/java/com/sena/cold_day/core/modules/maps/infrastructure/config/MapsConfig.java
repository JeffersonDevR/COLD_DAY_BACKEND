package com.sena.cold_day.core.modules.maps.infrastructure.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Registers the Maps configuration properties without touching the existing
 * SecurityConfig.
 */
@Configuration
@EnableConfigurationProperties({ MapsProperties.class, MapsConfigProperties.class })
public class MapsConfig {
}
