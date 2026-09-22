package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.spatial;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.geolocalizacion.domain.repository.TecnicoDisponibilidadRepository;
import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.persistence.EntityManager;

/**
 * PostGIS implementation of the spatial availability port (design D9, RF-F1-07,
 * RNF-03): the radius filter and the distance both run inside PostgreSQL with
 * {@code ST_DWithin}/{@code ST_Distance} over geography, backed by the partial
 * GiST index {@code idx_tecnico_disponible_ubicacion_geo} (see
 * {@code schema-postgres.sql}), scoped to the same {@code activo}/
 * {@code estado_validacion}/{@code estado_operativo} predicate used below.
 * Active only under the {@code postgres} profile. Plain lat/long columns are
 * kept, so no PostGIS-mapped type crosses the port boundary.
 */
@Repository
@Profile("postgres")
public class PostgisTecnicoDisponibilidadAdapter implements TecnicoDisponibilidadRepository {

    private static final double METROS_POR_KM = 1000.0;

    private static final String BUSQUEDA_ESPACIAL = """
            SELECT t.id, ST_Distance(
                ST_MakePoint(t.longitud, t.latitud)::geography,
                ST_MakePoint(:lon, :lat)::geography) / 1000.0
            FROM tecnico t
            WHERE t.activo = true
              AND t.estado_validacion = 'APROBADO'
              AND t.estado_operativo = 'DISPONIBLE'
              AND t.latitud IS NOT NULL
              AND t.longitud IS NOT NULL
              AND ST_DWithin(
                ST_MakePoint(t.longitud, t.latitud)::geography,
                ST_MakePoint(:lon, :lat)::geography,
                :radioMetros)
            ORDER BY 2
            """;

    private final EntityManager entityManager;
    private final SpringDataTecnicoRepository repository;

    public PostgisTecnicoDisponibilidadAdapter(EntityManager entityManager,
            SpringDataTecnicoRepository repository) {
        this.entityManager = entityManager;
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public List<TecnicoCercano> buscarDisponiblesEnRadio(Point centro, double radioKm,
            Set<CategoriaServicio> categorias) {
        if (centro == null) {
            throw new IllegalArgumentException("El centro de busqueda es requerido");
        }
        if (radioKm <= 0) {
            throw new IllegalArgumentException("El radio debe ser positivo");
        }
        List<Object[]> filas = entityManager.createNativeQuery(BUSQUEDA_ESPACIAL)
                .setParameter("lat", centro.latitud())
                .setParameter("lon", centro.longitud())
                .setParameter("radioMetros", radioKm * METROS_POR_KM)
                .getResultList();
        if (filas.isEmpty()) {
            return List.of();
        }
        Map<UUID, Double> distancias = new LinkedHashMap<>();
        for (Object[] fila : filas) {
            distancias.put(convertirId(fila[0]), ((Number) fila[1]).doubleValue());
        }
        Map<UUID, Tecnico> tecnicos = repository.findAllById(distancias.keySet()).stream()
                .map(TecnicoJpaEntity::toDomain)
                .collect(Collectors.toMap(tecnico -> tecnico.getId().valor(), tecnico -> tecnico));
        return distancias.entrySet().stream()
                .filter(entrada -> tecnicos.containsKey(entrada.getKey()))
                .map(entrada -> tecnicos.get(entrada.getKey()))
                .filter(tecnico -> tecnico.getUbicacion() != null)
                .filter(tecnico -> coincideCategoria(tecnico.getCategoriasServicio(), categorias))
                .map(tecnico -> new TecnicoCercano(tecnico.getId(), distancias.get(tecnico.getId().valor())))
                .toList();
    }

    private UUID convertirId(Object id) {
        if (id instanceof UUID uuid) {
            return uuid;
        }
        return UUID.fromString(String.valueOf(id));
    }

    private boolean coincideCategoria(Set<CategoriaServicio> tecnicas, Set<CategoriaServicio> solicitadas) {
        if (solicitadas == null || solicitadas.isEmpty()) {
            return true;
        }
        return tecnicas.stream().anyMatch(solicitadas::contains);
    }
}
