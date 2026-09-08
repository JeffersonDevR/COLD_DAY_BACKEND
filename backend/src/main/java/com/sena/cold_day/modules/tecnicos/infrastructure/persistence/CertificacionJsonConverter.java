package com.sena.cold_day.modules.tecnicos.infrastructure.persistence;

import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class CertificacionJsonConverter implements AttributeConverter<Set<Certificacion>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper().registerModule(new JavaTimeModule());

    @Override
    public String convertToDatabaseColumn(Set<Certificacion> value) {
        try {
            return MAPPER.writeValueAsString(value == null ? Set.of() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not serialize certifications", exception);
        }
    }

    @Override
    public Set<Certificacion> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return new HashSet<>();
        }
        try {
            return MAPPER.readValue(value, new TypeReference<Set<Certificacion>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not deserialize certifications", exception);
        }
    }
}
