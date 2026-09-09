package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

public record TecnicoApiResponse(Long id, String numeroIdentificacion, String nombres, String apellidos,
        String telefono, String email, String fotoUrl, Set<CategoriaServicio> categoriasServicio,
        EstadoOperativo estadoOperativo, Set<Certificacion> certificaciones, boolean activo) {

    public static TecnicoApiResponse from(TecnicoResponse response) {
        return new TecnicoApiResponse(response.id(), response.numeroIdentificacion(), response.nombres(),
                response.apellidos(), response.telefono(), response.email(), response.fotoUrl(),
                response.categoriasServicio(), response.estadoOperativo(), response.certificaciones(), response.activo());
    }
}
