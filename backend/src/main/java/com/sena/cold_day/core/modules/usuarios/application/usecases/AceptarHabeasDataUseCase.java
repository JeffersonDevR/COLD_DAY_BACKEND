package com.sena.cold_day.core.modules.usuarios.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.UsuarioNoEncontradoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@Service
public class AceptarHabeasDataUseCase {

    private final UsuarioRepository repository;

    public AceptarHabeasDataUseCase(UsuarioRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void aceptar(Long usuarioId) {
        Usuario usuario = repository.buscarPorId(new UsuarioId(usuarioId))
                .orElseThrow(() -> new UsuarioNoEncontradoException(usuarioId));
        usuario.aceptarHabeasData();
        repository.save(usuario);
    }
}
