package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.util.LinkedHashSet;
import java.util.Set;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Persists the supplier's insumo categories into the single
 * {@code categorias_insumo} column (design schema). Categories are descriptive
 * metadata, never an eligibility gate (design AD7).
 */
@Converter
public class CategoriasInsumoJsonConverter implements AttributeConverter<Set<String>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(Set<String> value) {
        try {
            return MAPPER.writeValueAsString(value == null ? Set.of() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not serialize insumo categories", exception);
        }
    }

    @Override
    public Set<String> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return new LinkedHashSet<>();
        }
        try {
            return MAPPER.readValue(value, new TypeReference<LinkedHashSet<String>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not deserialize insumo categories", exception);
        }
    }
}
