package com.sena.cold_day.core.modules.proveedores.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.sena.cold_day.core.modules.proveedores.domain.services.CalculadoraEtaInsumo;

/** Wires the insumo ETA rules from {@code app.insumos.*} (defaults are Claude's, not product policy). */
@Configuration
public class InsumosConfig {

    @Bean
    public CalculadoraEtaInsumo calculadoraEtaInsumo(
            @Value("${app.insumos.velocidad-kmh:30}") double velocidadKmh,
            @Value("${app.insumos.eta-maximo-minutos:240}") int etaMaximoMinutos) {
        return new CalculadoraEtaInsumo(velocidadKmh, etaMaximoMinutos);
    }
}
