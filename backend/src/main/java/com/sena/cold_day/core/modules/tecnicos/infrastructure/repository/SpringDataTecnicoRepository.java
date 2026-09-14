package com.sena.cold_day.core.modules.tecnicos.infrastructure.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;

public interface SpringDataTecnicoRepository extends JpaRepository<TecnicoJpaEntity, UUID> {
    List<TecnicoJpaEntity> findByActivoTrue();
    Optional<TecnicoJpaEntity> findByIdAndActivoTrue(UUID id);
    Optional<TecnicoJpaEntity> findByUsuarioIdAndActivoTrue(Long usuarioId);

    /**
     * Spatial pre-filter for the geolocalizacion module: a lat/long bounding
     * box over eligible technicians. The adapter applies the exact Haversine
     * distance afterwards, so the box only needs to be a superset.
     */
    List<TecnicoJpaEntity> findByActivoTrueAndEstadoValidacionAndEstadoOperativoAndLatitudBetweenAndLongitudBetween(
            EstadoValidacion estadoValidacion, EstadoOperativo estadoOperativo,
            Double latitudDesde, Double latitudHasta, Double longitudDesde, Double longitudHasta);
}
