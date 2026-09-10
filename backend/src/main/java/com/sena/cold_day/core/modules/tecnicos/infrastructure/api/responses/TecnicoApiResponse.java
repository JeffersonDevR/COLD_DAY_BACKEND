package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
public record TecnicoApiResponse(TecnicoId id, Long usuarioId, String nombre, String correo, String telefono,
                                 String numeroIdentificacion, String fotoUrl, Set<CategoriaServicio> categoriasServicio,
                                 EstadoOperativo estadoOperativo, EstadoValidacion estadoValidacion, String motivoRechazoValidacion,
                                 Set<Certificacion> certificaciones, boolean activo) {

    public static TecnicoApiResponse from(TecnicoResponse response) {
        return new TecnicoApiResponse(TecnicoId.desde(String.valueOf(response.id())), response.usuarioId(), response.nombre(), response.correo(),
                response.telefono(), response.numeroIdentificacion(), response.fotoUrl(),
                response.categoriasServicio(), response.estadoOperativo(), response.estadoValidacion(),
                response.motivoRechazoValidacion(), response.certificaciones(), response.activo());
    }
}
