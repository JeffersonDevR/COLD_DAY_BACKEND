package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataIncumplimientoInsumoRepository
        extends JpaRepository<IncumplimientoInsumoJpaEntity, UUID> {

    List<IncumplimientoInsumoJpaEntity> findTop200ByOrderByReemplazadoEnDesc();
}
