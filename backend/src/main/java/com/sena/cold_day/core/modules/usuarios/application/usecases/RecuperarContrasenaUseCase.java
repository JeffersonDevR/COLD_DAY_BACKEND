package com.sena.cold_day.core.modules.usuarios.application.usecases;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;

@Service
public class RecuperarContrasenaUseCase {

    private final UsuarioRepository repository;
    private final ApplicationEventPublisher events;

    public RecuperarContrasenaUseCase(UsuarioRepository repository, ApplicationEventPublisher events) {
        this.repository = repository;
        this.events = events;
    }

    public record RecuperacionSolicitada(Long usuarioId, String correo) {
    }

    @Transactional
    public void recuperar(String correo) {
        Usuario usuario = repository.buscarPorCorreo(correo)
                .orElseThrow(() -> new UsuarioNoEncontradoException(correo));
        usuario.recuperarContrasena();
        repository.save(usuario);
        events.publishEvent(new RecuperacionSolicitada(usuario.getId(), usuario.getCorreo()));
    }
}
