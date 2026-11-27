package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

public interface SpringDataUsuarioRepository extends JpaRepository<UsuarioJpaEntity, Long> {

    Optional<UsuarioJpaEntity> findByCorreo(String correo);

    boolean existsByCorreo(String correo);

    List<UsuarioJpaEntity> findByRolInOrderById(Collection<Rol> roles);
}
