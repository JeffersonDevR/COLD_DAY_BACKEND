package com.sena.cold_day.core.modules.maps.infrastructure.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Registra {@link MapsProperties} sin tocar el SecurityConfig existente.
 */
@Configuration
@EnableConfigurationProperties(MapsProperties.class)
public class MapsConfig {
}
