package com.sena.cold_day.modules.tecnicos.infrastructure.persistence;

import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class CategoriaServicioJsonConverter implements AttributeConverter<Set<CategoriaServicio>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(Set<CategoriaServicio> value) {
        try {
            return MAPPER.writeValueAsString(value == null ? Set.of() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not serialize service categories", exception);
        }
    }

    @Override
    public Set<CategoriaServicio> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return new HashSet<>();
        }
        try {
            return MAPPER.readValue(value, new TypeReference<Set<CategoriaServicio>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not deserialize service categories", exception);
        }
    }
}
