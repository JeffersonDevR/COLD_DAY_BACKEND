package com.sena.cold_day.core.modules.tecnicos.application.mappers;

import org.springframework.stereotype.Component;



import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;



@Component
public class TecnicoMapper {

    /** Profile-only apply used on updates (identity fields belong to Usuario). */
    public void apply(TecnicoRequest request, Tecnico tecnico, Usuario usuario) {
        tecnico.actualizarPerfil(request.numeroIdentificacion());
        tecnico.reemplazarCategorias(request.categoriasServicio());
        tecnico.reemplazarCertificaciones(request.certificaciones());
        usuario.actualizarPerfil(request.nombre(), request.telefono(), request.fotoUrl());
    }

    public TecnicoResponse toResponse(Usuario usuario, Tecnico tecnico) {
        return new TecnicoResponse(tecnico.getId(), usuario.getId(), usuario.getNombre(), usuario.getCorreo(),
                usuario.getTelefono(), tecnico.getNumeroIdentificacion(), usuario.getFotoUrl(),
                tecnico.getCategoriasServicio(), tecnico.getEstadoOperativo(), tecnico.getEstadoValidacion(),
                tecnico.getMotivoRechazoValidacion(), tecnico.getCertificaciones(), tecnico.isActivo());
    }
}
