package com.sena.cold_day.core.modules.tecnicos.infrastructure.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;

public interface SpringDataTecnicoRepository extends JpaRepository<TecnicoJpaEntity, UUID> {
    List<TecnicoJpaEntity> findByActivoTrue();
    Optional<TecnicoJpaEntity> findByIdAndActivoTrue(UUID id);

    List<TecnicoJpaEntity> findByIdInAndActivoTrue(Collection<UUID> ids);
    Optional<TecnicoJpaEntity> findByUsuarioIdAndActivoTrue(Long usuarioId);
    Optional<TecnicoJpaEntity> findByUsuarioId(Long usuarioId);

    /**
     * Spatial pre-filter for the geolocalizacion module: a lat/long bounding
     * box over eligible technicians. The adapter applies the exact Haversine
     * distance afterwards, so the box only needs to be a superset.
     */
    List<TecnicoJpaEntity> findByActivoTrueAndEstadoValidacionAndEstadoOperativoAndLatitudBetweenAndLongitudBetween(
            EstadoValidacion estadoValidacion, EstadoOperativo estadoOperativo,
            Double latitudDesde, Double latitudHasta, Double longitudDesde, Double longitudHasta);

    /**
     * Puerta atomica del tecnico (un tecnico no puede quedar en dos OTs). El
     * UPDATE condicional deja que solo un accept concurrente gane; el resto
     * recibe 0 filas y revierte.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE TecnicoJpaEntity t SET t.estadoOperativo = :ocupado "
            + "WHERE t.id = :id AND t.estadoOperativo = :disponible AND t.estadoValidacion = :aprobado")
    int ocuparSiDisponible(@Param("id") UUID id,
            @Param("ocupado") EstadoOperativo ocupado,
            @Param("disponible") EstadoOperativo disponible,
            @Param("aprobado") EstadoValidacion aprobado);
}
