package com.sena.cold_day.modules.tecnicos.infrastructure.adapters;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.r2dbc.config.AbstractR2dbcConfiguration;
import org.springframework.data.r2dbc.convert.R2dbcCustomConversions;
import io.r2dbc.spi.ConnectionFactory;

import java.util.ArrayList;
import java.util.List;

@Configuration
public class R2dbcConfig extends AbstractR2dbcConfiguration {

    private final ConnectionFactory connectionFactory;

    public R2dbcConfig(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public ConnectionFactory connectionFactory() {
        return connectionFactory;
    }

    @Bean
    @Override
    public R2dbcCustomConversions r2dbcCustomConversions() {
        List<Object> converters = new ArrayList<>();
        converters.add(JsonConverters.SetCategoriaServicioToStringConverter.INSTANCE);
        converters.add(JsonConverters.StringToSetCategoriaServicioConverter.INSTANCE);
        converters.add(JsonConverters.SetCertificacionToStringConverter.INSTANCE);
        converters.add(JsonConverters.StringToSetCertificacionConverter.INSTANCE);
        return new R2dbcCustomConversions(getStoreConversions(), converters);
    }
}
