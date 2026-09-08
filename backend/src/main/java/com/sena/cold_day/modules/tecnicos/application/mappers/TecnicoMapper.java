package com.sena.cold_day.modules.tecnicos.application.mappers;

import java.util.Set;

import org.springframework.stereotype.Component;

import com.sena.cold_day.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;

@Component
public class TecnicoMapper {

    public Tecnico toDomain(TecnicoRequest request) {
        Tecnico tecnico = new Tecnico();
        apply(request, tecnico);
        return tecnico;
    }

    public void apply(TecnicoRequest request, Tecnico tecnico) {
        tecnico.setNumeroIdentificacion(request.numeroIdentificacion());
        tecnico.setNombres(request.nombres());
        tecnico.setApellidos(request.apellidos());
        tecnico.setTelefono(request.telefono());
        tecnico.setEmail(request.email());
        tecnico.setFotoUrl(request.fotoUrl());
        tecnico.setCategoriasServicio(request.categoriasServicio() == null ? Set.of() : request.categoriasServicio());
        tecnico.setCertificaciones(request.certificaciones() == null ? Set.of() : request.certificaciones());
    }

    public TecnicoResponse toResponse(Tecnico tecnico) {
        return new TecnicoResponse(tecnico.getId(), tecnico.getNumeroIdentificacion(), tecnico.getNombres(),
                tecnico.getApellidos(), tecnico.getTelefono(), tecnico.getEmail(), tecnico.getFotoUrl(),
                tecnico.getCategoriasServicio(), tecnico.getEstadoOperativo(), tecnico.getCertificaciones(),
                tecnico.isActivo());
    }
}
