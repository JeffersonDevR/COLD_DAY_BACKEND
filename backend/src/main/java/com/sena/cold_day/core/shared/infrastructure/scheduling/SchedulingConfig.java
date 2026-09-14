package com.sena.cold_day.core.shared.infrastructure.scheduling;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables scheduled tasks (e.g. the daily documentary-vigencia sweep). Kept in
 * shared config so each module owns its jobs but the annotation lives once.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
