package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataUsuarioRepository extends JpaRepository<UsuarioJpaEntity, Long> {

    Optional<UsuarioJpaEntity> findByCorreo(String correo);

    boolean existsByCorreo(String correo);
}
