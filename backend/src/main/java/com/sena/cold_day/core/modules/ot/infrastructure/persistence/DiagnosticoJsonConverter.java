package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Serializes the technician {@link Diagnostico} into a JSON column. The
 * {@link JavaTimeModule} is registered because the record carries an
 * {@code Instant} (RF-F1-11).
 */
@Converter
public class DiagnosticoJsonConverter implements AttributeConverter<Diagnostico, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Override
    public String convertToDatabaseColumn(Diagnostico value) {
        try {
            return value == null ? null : MAPPER.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not serialize the diagnosis", exception);
        }
    }

    @Override
    public Diagnostico convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(value, Diagnostico.class);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not deserialize the diagnosis", exception);
        }
    }
}
