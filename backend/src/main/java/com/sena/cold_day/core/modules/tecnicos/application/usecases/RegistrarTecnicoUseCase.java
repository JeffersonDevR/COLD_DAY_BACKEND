package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.application.mappers.TecnicoMapper;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoCreado;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/**
 * Coordinates the Usuario (identity) and Tecnico (profile) aggregates in a
 * single application transaction. Depends only on the UsuarioRepository port
 * of the usuarios module — never on usuarios.infrastructure.
 */
@Service
public class RegistrarTecnicoUseCase {

    private final TecnicoRepository tecnicoRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoderPort passwordEncoder;
    private final ApplicationEventPublisher events;
    private final TecnicoMapper mapper;

    public RegistrarTecnicoUseCase(TecnicoRepository tecnicoRepository, UsuarioRepository usuarioRepository,
            PasswordEncoderPort passwordEncoder, ApplicationEventPublisher events, TecnicoMapper mapper) {
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
        this.mapper = mapper;
    }

    @Transactional
    public TecnicoResponse registrar(TecnicoRequest request) {
        if (usuarioRepository.existeCorreo(request.correo())) {
            throw new CorreoDuplicadoException(request.correo());
        }

        Usuario usuario = usuarioRepository.save(
                com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario.registrar(
                        request.nombre(), request.correo(), request.password(), request.telefono(),
                        request.fotoUrl(), Rol.TECNICO, passwordEncoder));

        Tecnico tecnico = tecnicoRepository.save(Tecnico.crear(
                usuario.getId(), request.numeroIdentificacion(), request.fotoUrl(),
                request.categoriasServicio(), request.certificaciones()));

        events.publishEvent(new TecnicoCreado(tecnico.getId()));
        return mapper.toResponse(usuario, tecnico);
    }
}
