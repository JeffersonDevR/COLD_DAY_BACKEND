package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.ProveedorJpaEntity;

public interface SpringDataProveedorRepository extends JpaRepository<ProveedorJpaEntity, UUID> {

    List<ProveedorJpaEntity> findByActivoTrue();

    Optional<ProveedorJpaEntity> findByUsuarioId(Long usuarioId);
}
