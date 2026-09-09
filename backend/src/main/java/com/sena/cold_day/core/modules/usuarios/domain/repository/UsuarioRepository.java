package com.sena.cold_day.core.modules.usuarios.domain.repository;

import java.util.Optional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Port implemented in infrastructure (JPA adapter). */
public interface UsuarioRepository {

    Usuario save(Usuario usuario);

    Optional<Usuario> buscarPorId(UsuarioId id);

    Optional<Usuario> buscarPorCorreo(String correo);

    boolean existeCorreo(String correo);
}
