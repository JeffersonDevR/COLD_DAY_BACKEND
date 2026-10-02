package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataDocumentoProveedorRepository extends JpaRepository<DocumentoProveedorJpaEntity, Long> {
    List<DocumentoProveedorJpaEntity> findByProveedorIdOrderByIdAsc(UUID proveedorId);
}
