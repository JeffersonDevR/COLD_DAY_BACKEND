package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Serializes the {@link Presupuesto} presented to the client into a JSON
 * column. The {@link JavaTimeModule} is registered because the record carries
 * an {@code Instant} (RF-F1-11/RF-F1-20).
 */
@Converter
public class PresupuestoJsonConverter implements AttributeConverter<Presupuesto, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Override
    public String convertToDatabaseColumn(Presupuesto value) {
        try {
            return value == null ? null : MAPPER.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not serialize the budget", exception);
        }
    }

    @Override
    public Presupuesto convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(value, Presupuesto.class);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not deserialize the budget", exception);
        }
    }
}
