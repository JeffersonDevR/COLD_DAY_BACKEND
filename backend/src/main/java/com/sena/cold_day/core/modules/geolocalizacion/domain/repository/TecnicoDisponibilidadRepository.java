package com.sena.cold_day.core.modules.geolocalizacion.domain.repository;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Persistence-agnostic spatial availability port (design D9, RF-F1-07). It
 * exposes only domain value objects: no JPA or PostGIS type crosses this
 * boundary. Implemented by the PostGIS adapter ({@code ST_DWithin}/
 * {@code ST_Distance} + GiST, RNF-03).
 */
public interface TecnicoDisponibilidadRepository {

    /**
     * Technicians that are active, {@code APROBADO}, {@code DISPONIBLE},
     * currently reporting a live position and within {@code radioKm} of
     * {@code centro}, optionally filtered by service category. An empty or null
     * {@code categorias} set matches every category.
     * <p>
     * A technician only counts as reporting when tracking is on and the last
     * position was stored at or after {@code desde}. Callers derive
     * {@code desde} from {@code Tecnico.desdeVigenciaUbicacion(ahora)}, so the
     * freshness window has a single source of truth in the domain.
     */
    List<TecnicoCercano> buscarDisponiblesEnRadio(Point centro, double radioKm,
            Set<CategoriaServicio> categorias, Instant desde);
}
