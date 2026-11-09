package com.sena.cold_day.core.modules.geolocalizacion.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.geolocalizacion.application.dto.TecnicoCercanoResponse;
import com.sena.cold_day.core.modules.geolocalizacion.domain.repository.TecnicoDisponibilidadRepository;
import com.sena.cold_day.core.modules.geolocalizacion.domain.valueobjects.TecnicoCercano;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * RF-F1-04: lista los técnicos disponibles dentro de un radio desde un punto,
 * enriquecidos con su perfil y datos de contacto para el radar del cliente.
 *
 * <p>El radar se consulta en bucle desde el cliente (y se refresca con SSE), así
 * que el enriquecimiento va por lote: una query de perfiles y otra de usuarios
 * para toda la lista. Antes era {@code 2 × N} queries por request, con N técnicos
 * en el radio.
 */
@Service
public class BuscarTecnicosCercanosUseCase {

    private static final String NOMBRE_SIN_PERFIL = "Técnico";

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
        List<TecnicoCercano> cercanos = disponibilidadRepository
                .buscarDisponiblesEnRadio(centro, radioKm, categorias, desde);
        if (cercanos.isEmpty()) {
            return List.of();
        }

        Map<TecnicoId, Tecnico> perfiles = tecnicoRepository
                .buscarPorIds(cercanos.stream().map(TecnicoCercano::tecnicoId).toList())
                .stream()
                .collect(Collectors.toMap(Tecnico::getId, tecnico -> tecnico, (primero, segundo) -> primero));
        Map<UsuarioId, Usuario> usuarios = usuarioRepository
                .buscarPorIds(perfiles.values().stream()
                        .map(tecnico -> new UsuarioId(tecnico.getUsuarioId()))
                        .toList())
                .stream()
                .collect(Collectors.toMap(Usuario::getUsuarioId, usuario -> usuario, (primero, segundo) -> primero));

        List<TecnicoCercanoResponse> respuesta = new ArrayList<>(cercanos.size());
        for (TecnicoCercano cercano : cercanos) {
            Tecnico tecnico = perfiles.get(cercano.tecnicoId());
            if (tecnico == null) {
                // El perfil se desactivo entre la busqueda espacial y esta lectura.
                continue;
            }
            Point ubicacion = tecnico.getUbicacion();
            Usuario usuario = usuarios.get(new UsuarioId(tecnico.getUsuarioId()));
            respuesta.add(aResponse(tecnico,
                    usuario == null ? NOMBRE_SIN_PERFIL : usuario.getNombre(),
                    usuario == null ? null : usuario.getTelefono(),
                    usuario == null ? null : usuario.getFotoUrl(),
                    cercano.distanciaKm(), ubicacion));
        }
        return respuesta;
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
