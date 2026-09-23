package com.sena.cold_day.core.modules.ot.infrastructure.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Registers {@link TarifaProperties} following the existing module convention
 * ({@code MapsConfig}).
 */
@Configuration
@EnableConfigurationProperties(TarifaProperties.class)
public class TarifaConfig {
}
