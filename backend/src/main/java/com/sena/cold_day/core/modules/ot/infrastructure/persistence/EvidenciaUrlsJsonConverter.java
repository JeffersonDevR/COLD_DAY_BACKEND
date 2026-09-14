package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Serializes the OT photographic evidence URLs into a JSON array column. */
@Converter
public class EvidenciaUrlsJsonConverter implements AttributeConverter<List<String>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(List<String> value) {
        try {
            return MAPPER.writeValueAsString(value == null ? List.of() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not serialize evidence urls", exception);
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(MAPPER.readValue(value, new TypeReference<List<String>>() { }));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not deserialize evidence urls", exception);
        }
    }
}
