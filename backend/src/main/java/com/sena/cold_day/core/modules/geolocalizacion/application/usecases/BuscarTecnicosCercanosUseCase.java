package com.sena.cold_day.core.modules.geolocalizacion.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.geolocalizacion.application.dto.TecnicoCercanoResponse;
import com.sena.cold_day.core.modules.geolocalizacion.domain.repository.TecnicoDisponibilidadRepository;
import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * RF-F1-04: lista los técnicos disponibles dentro de un radio desde un punto,
 * enriquecidos con su perfil y datos de contacto para el radar del cliente.
 */
@Service
public class BuscarTecnicosCercanosUseCase {

    private final TecnicoDisponibilidadRepository disponibilidadRepository;
    private final TecnicoRepository tecnicoRepository;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public BuscarTecnicosCercanosUseCase(TecnicoDisponibilidadRepository disponibilidadRepository,
            TecnicoRepository tecnicoRepository, UsuarioRepository usuarioRepository, Clock clock) {
        this.disponibilidadRepository = disponibilidadRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<TecnicoCercanoResponse> buscar(Point centro, double radioKm, Set<CategoriaServicio> categorias) {
        // The radar only lists technicians whose position is fresh: the window
        // comes from the aggregate, never from a local literal.
        Instant desde = Tecnico.desdeVigenciaUbicacion(clock.instant());
        return disponibilidadRepository.buscarDisponiblesEnRadio(centro, radioKm, categorias, desde).stream()
                .map(this::enriquecer)
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<TecnicoCercanoResponse> enriquecer(TecnicoCercano cercano) {
        return tecnicoRepository.findByIdAndActivoTrue(cercano.tecnicoId()).map(tecnico -> {
            Point ubicacion = tecnico.getUbicacion();
            return usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId()))
                    .map(usuario -> aResponse(tecnico, usuario.getNombre(), usuario.getTelefono(),
                            usuario.getFotoUrl(), cercano.distanciaKm(), ubicacion))
                    .orElseGet(() -> aResponse(tecnico, "Técnico", null, null, cercano.distanciaKm(), ubicacion));
        });
    }

    private TecnicoCercanoResponse aResponse(Tecnico tecnico, String nombre, String telefono, String fotoUrl,
            double distanciaKm, Point ubicacion) {
        return new TecnicoCercanoResponse(
                tecnico.getId().valor().toString(),
                nombre,
                telefono,
                fotoUrl,
                tecnico.getCategoriasServicio(),
                distanciaKm,
                ubicacion.latitud(),
                ubicacion.longitud(),
                tecnico.getEstadoOperativo() == EstadoOperativo.DISPONIBLE);
    }
}
