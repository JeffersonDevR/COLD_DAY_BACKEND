package com.sena.cold_day.core.modules.clientes.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataClienteRepository extends JpaRepository<ClienteJpaEntity, UUID> {

    Optional<ClienteJpaEntity> findByUsuarioId(Long usuarioId);

    List<ClienteJpaEntity> findByActivoTrue();
}
