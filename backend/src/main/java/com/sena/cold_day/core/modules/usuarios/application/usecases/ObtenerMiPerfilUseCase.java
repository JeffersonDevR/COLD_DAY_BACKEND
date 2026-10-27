package com.sena.cold_day.core.modules.usuarios.application.usecases;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.application.dto.MiPerfilResponse;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PerfilesDeUsuarioPort;
import com.sena.cold_day.core.modules.usuarios.domain.services.RolesDePerfilPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Roadmap B3: single read that answers "who am I" for the native app after
 * login: identity from the usuario aggregate plus the role set and the
 * cliente/tecnico/proveedor profile ids resolved from the persisted rows.
 * Read-only — nothing here mutates state, and no rate limit is involved.
 */
@Service
public class ObtenerMiPerfilUseCase {

    private final UsuarioRepository usuarioRepository;
    private final RolesDePerfilPort rolesDePerfil;
    private final PerfilesDeUsuarioPort perfilesDeUsuario;

    public ObtenerMiPerfilUseCase(UsuarioRepository usuarioRepository, RolesDePerfilPort rolesDePerfil,
            PerfilesDeUsuarioPort perfilesDeUsuario) {
        this.usuarioRepository = usuarioRepository;
        this.rolesDePerfil = rolesDePerfil;
        this.perfilesDeUsuario = perfilesDeUsuario;
    }

    @Transactional(readOnly = true)
    public MiPerfilResponse obtener(UsuarioId usuarioId) {
        Usuario usuario = usuarioRepository.buscarPorId(usuarioId)
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId.valor()));
        var roles = rolesDePerfil.resolver(usuarioId, usuario.getRol());
        var perfiles = perfilesDeUsuario.resolver(usuarioId);
        List<String> nombresRoles = roles.stream().map(Enum::name).toList();
        return new MiPerfilResponse(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getCorreo(),
                usuario.getRol().name(),
                nombresRoles,
                perfiles.clientePerfilId().orElse(null),
                perfiles.tecnicoPerfilId().orElse(null),
                perfiles.proveedorPerfilId().orElse(null));
    }
}
