package com.sena.cold_day.core.modules.usuarios.application.mappers;

import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;

@Component
public class UsuarioMapper {

    public UsuarioResponse toResponse(Usuario usuario) {
        return new UsuarioResponse(usuario.getId(), usuario.getNombre(), usuario.getCorreo(),
                usuario.getTelefono(), usuario.getFotoUrl(), usuario.getRol(), usuario.getFechaRegistro(),
                usuario.isHabeasDataAceptado(), usuario.isActivo());
    }
}
