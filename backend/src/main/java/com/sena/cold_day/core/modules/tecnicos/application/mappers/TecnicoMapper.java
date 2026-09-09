package com.sena.cold_day.core.modules.tecnicos.application.mappers;

import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;

@Component
public class TecnicoMapper {

    public Tecnico toDomain(TecnicoRequest request) {
        return Tecnico.crear(request.numeroIdentificacion(), request.nombres(), request.apellidos(), request.telefono(),
                request.email(), request.fotoUrl(), request.categoriasServicio(), request.certificaciones());
    }

    public void apply(TecnicoRequest request, Tecnico tecnico) {
        tecnico.actualizarPerfil(request.numeroIdentificacion(), request.nombres(), request.apellidos(),
                request.telefono(), request.email(), request.fotoUrl());
        tecnico.reemplazarCategorias(request.categoriasServicio());
        tecnico.reemplazarCertificaciones(request.certificaciones());
    }

    public TecnicoResponse toResponse(Tecnico tecnico) {
        return new TecnicoResponse(tecnico.getId(), tecnico.getNumeroIdentificacion(), tecnico.getNombres(),
                tecnico.getApellidos(), tecnico.getTelefono(), tecnico.getEmail(), tecnico.getFotoUrl(),
                tecnico.getCategoriasServicio(), tecnico.getEstadoOperativo(), tecnico.getCertificaciones(),
                tecnico.isActivo());
    }
}
