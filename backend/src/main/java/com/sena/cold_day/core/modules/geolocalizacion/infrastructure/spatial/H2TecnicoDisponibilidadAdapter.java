package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.spatial;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.geolocalizacion.domain.repository.TecnicoDisponibilidadRepository;
import com.sena.cold_day.core.modules.geolocalizacion.domain.services.CalculadoraHaversine;
import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence.TecnicoJpaEntity;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * H2/Haversine implementation of the spatial availability port (design D9):
 * a cheap bounding-box pre-filter in SQL, then an exact great-circle filter in
 * memory. No PostGIS dependency; longitudes near ±180 are not wrapped because
 * the MVP operates over Colombia. Default adapter for dev/test; replaced by
 * {@code PostgisTecnicoDisponibilidadAdapter} under the {@code postgres} profile.
 */
@Repository
@Profile("!postgres")
public class H2TecnicoDisponibilidadAdapter implements TecnicoDisponibilidadRepository {

    private static final double RADIO_TIERRA_KM = 6371.0;
    private static final double MEDIA_CIRCUNFERENCIA_GRADOS = 180.0;

    private final SpringDataTecnicoRepository repository;

    public H2TecnicoDisponibilidadAdapter(SpringDataTecnicoRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TecnicoCercano> buscarDisponiblesEnRadio(Point centro, double radioKm,
            Set<CategoriaServicio> categorias) {
        if (centro == null) {
            throw new IllegalArgumentException("El centro de busqueda es requerido");
        }
        if (radioKm <= 0) {
            throw new IllegalArgumentException("El radio debe ser positivo");
        }
        double latitudDelta = Math.toDegrees(radioKm / RADIO_TIERRA_KM);
        double cosLatitud = Math.cos(Math.toRadians(centro.latitud()));
        double longitudDelta = cosLatitud <= 0
                ? MEDIA_CIRCUNFERENCIA_GRADOS
                : Math.min(MEDIA_CIRCUNFERENCIA_GRADOS,
                        Math.toDegrees(radioKm / (RADIO_TIERRA_KM * cosLatitud)));

        List<TecnicoJpaEntity> candidatos = repository
                .findByActivoTrueAndEstadoValidacionAndEstadoOperativoAndLatitudBetweenAndLongitudBetween(
                        EstadoValidacion.APROBADO, EstadoOperativo.DISPONIBLE,
                        centro.latitud() - latitudDelta, centro.latitud() + latitudDelta,
                        centro.longitud() - longitudDelta, centro.longitud() + longitudDelta);

        return candidatos.stream()
                .map(TecnicoJpaEntity::toDomain)
                .filter(tecnico -> tecnico.getUbicacion() != null)
                .filter(tecnico -> coincideCategoria(tecnico.getCategoriasServicio(), categorias))
                .map(tecnico -> new TecnicoCercano(tecnico.getId(),
                        CalculadoraHaversine.distanciaKm(centro, tecnico.getUbicacion())))
                .filter(cercano -> cercano.distanciaKm() <= radioKm)
                .sorted(Comparator.comparingDouble(TecnicoCercano::distanciaKm))
                .toList();
    }

    private boolean coincideCategoria(Set<CategoriaServicio> tecnicas, Set<CategoriaServicio> solicitadas) {
        if (solicitadas == null || solicitadas.isEmpty()) {
            return true;
        }
        return tecnicas.stream().anyMatch(solicitadas::contains);
    }
}
