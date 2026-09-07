package com.sena.cold_day.modules.tecnicos.infrastructure.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;

import io.r2dbc.spi.Row;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.util.Set;
import java.util.HashSet;

public class JsonConverters {

    private static final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @WritingConverter
    public enum SetCategoriaServicioToStringConverter implements Converter<Set<CategoriaServicio>, String> {
        INSTANCE;

        @Override
        public String convert(Set<CategoriaServicio> source) {
            try {
                return objectMapper.writeValueAsString(source);
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Error writing JSON for CategoriaServicio", e);
            }
        }
    }

    @ReadingConverter
    public enum StringToSetCategoriaServicioConverter implements Converter<String, Set<CategoriaServicio>> {
        INSTANCE;

        @Override
        public Set<CategoriaServicio> convert(String source) {
            try {
                return objectMapper.readValue(source, new TypeReference<Set<CategoriaServicio>>() {});
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Error reading JSON for CategoriaServicio", e);
            }
        }
    }

    @WritingConverter
    public enum SetCertificacionToStringConverter implements Converter<Set<Certificacion>, String> {
        INSTANCE;

        @Override
        public String convert(Set<Certificacion> source) {
            try {
                return objectMapper.writeValueAsString(source);
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Error writing JSON for Certificacion", e);
            }
        }
    }

    @ReadingConverter
    public enum StringToSetCertificacionConverter implements Converter<String, Set<Certificacion>> {
        INSTANCE;

        @Override
        public Set<Certificacion> convert(String source) {
            try {
                return objectMapper.readValue(source, new TypeReference<Set<Certificacion>>() {});
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Error reading JSON for Certificacion", e);
            }
        }
    }
}
