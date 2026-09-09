package com.sena.cold_day.core.modules.usuarios.application.usecases;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioRequest;
import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioResponse;
import com.sena.cold_day.core.modules.usuarios.application.mappers.UsuarioMapper;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.events.UsuarioRegistrado;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;

@Service
public class RegistrarUsuarioUseCase {

    private final UsuarioRepository repository;
    private final PasswordEncoderPort passwordEncoder;
    private final ApplicationEventPublisher events;
    private final UsuarioMapper mapper;

    public RegistrarUsuarioUseCase(UsuarioRepository repository, PasswordEncoderPort passwordEncoder,
            ApplicationEventPublisher events, UsuarioMapper mapper) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
        this.mapper = mapper;
    }

    @Transactional
    public UsuarioResponse registrar(UsuarioRequest request) {
        if (repository.existeCorreo(request.correo())) {
            throw new CorreoDuplicadoException(request.correo());
        }
        Usuario usuario = Usuario.registrar(request.nombre(), request.correo(), request.password(),
                request.telefono(), request.fotoUrl(), request.rol(), passwordEncoder);
        Usuario saved = repository.save(usuario);
        events.publishEvent(new UsuarioRegistrado(saved.getId(), saved.getRol()));
        return mapper.toResponse(saved);
    }
}
