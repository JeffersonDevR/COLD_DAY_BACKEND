package com.sena.cold_day.core.modules.usuarios.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.application.dto.SolicitudPerfilRequest;
import com.sena.cold_day.core.modules.usuarios.application.dto.SolicitudPerfilResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.SolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.SolicitudPerfilDuplicadaException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.SolicitudPerfilRepository;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Alta de una solicitud de cambio de perfil para el principal autenticado. */
@Service
public class CrearSolicitudPerfilUseCase {

    private final SolicitudPerfilRepository solicitudes;
    private final UsuarioRepository usuarios;

    public CrearSolicitudPerfilUseCase(SolicitudPerfilRepository solicitudes, UsuarioRepository usuarios) {
        this.solicitudes = solicitudes;
        this.usuarios = usuarios;
    }

    @Transactional
    public SolicitudPerfilResponse crear(UsuarioId usuarioId, SolicitudPerfilRequest request) {
        Usuario usuario = usuarios.buscarPorId(usuarioId)
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId.valor()));

        if (solicitudes.existePendiente(usuarioId.valor(), request.perfilDeseado())) {
            throw new SolicitudPerfilDuplicadaException();
        }

        SolicitudPerfil solicitud = SolicitudPerfil.crear(usuarioId.valor(), request.perfilDeseado(),
                usuario.getRol(), request.motivacion());
        return SolicitudPerfilResponse.from(solicitudes.save(solicitud));
    }
}
