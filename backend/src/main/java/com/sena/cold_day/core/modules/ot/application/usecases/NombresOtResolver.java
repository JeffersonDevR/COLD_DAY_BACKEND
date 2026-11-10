package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.application.dto.OtResumenResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Resolves the display names of an OT's client and technician.
 *
 * <p>Single shared place for the "readable names of this order" lookup used by
 * the listings, the OT detail and every OT mutation response, so a new read or
 * mutation path cannot ship a response without the names the UI renders. Before
 * this existed the lookup lived inside the listing use case, and every other
 * path lost the names.
 *
 * <p>An absent profile — no technician assigned yet, client without a linked
 * user — resolves to {@code null}. That is deliberate: the caller renders the
 * honest fallback ("Por asignar") and no name is ever invented.
 */
@Service
public class NombresOtResolver {

    private final ClienteRepository clienteRepository;
    private final TecnicoRepository tecnicoRepository;
    private final UsuarioRepository usuarioRepository;

    public NombresOtResolver(ClienteRepository clienteRepository, TecnicoRepository tecnicoRepository,
            UsuarioRepository usuarioRepository) {
        this.clienteRepository = clienteRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    /** Display name of the client, or {@code null} when the id is absent or unknown. */
    public String nombreCliente(ClienteId clienteId) {
        if (clienteId == null) {
            return null;
        }
        return clienteRepository.buscarPorId(clienteId)
                .flatMap(cliente -> usuarioRepository.buscarPorId(cliente.getUsuarioId()))
                .map(Usuario::getNombre)
                .orElse(null);
    }

    /**
     * Display name of the assigned technician, or {@code null} when the OT has no
     * technician yet or the profile was deactivated.
     */
    public String nombreTecnico(TecnicoId tecnicoId) {
        if (tecnicoId == null) {
            return null;
        }
        return tecnicoRepository.findByIdAndActivoTrue(tecnicoId)
                .flatMap(tecnico -> usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId())))
                .map(Usuario::getNombre)
                .orElse(null);
    }

    /**
     * Telefono del tecnico asignado, o {@code null} cuando la OT no tiene tecnico
     * o su perfil fue desactivado.
     *
     * <p>Vive aca, junto a los nombres, porque el detalle y las mutaciones de la OT
     * lo publican en la misma respuesta: separarlo dejaba al cliente sin el numero
     * para llamar al tecnico que ya va en camino. Se resuelve contra el usuario
     * (igual que {@link #nombreTecnico}) para no duplicar la regla de "tecnico
     * activo".
     */
    public String telefonoTecnico(TecnicoId tecnicoId) {
        if (tecnicoId == null) {
            return null;
        }
        return tecnicoRepository.findByIdAndActivoTrue(tecnicoId)
                .flatMap(tecnico -> usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId())))
                .map(Usuario::getTelefono)
                .orElse(null);
    }

    /**
     * Enriches a whole listing. Los nombres se resuelven en lote: una query de
     * clientes, una de tecnicos y una de usuarios para toda la lista. Antes era
     * un minimo de dos queries por cliente/tecnico distinto (el memo por id no
     * ayudaba cuando cada OT era de un cliente distinto).
     */
    public List<OtResumenResponse> enriquecer(List<OtResponse> ots) {
        if (ots.isEmpty()) {
            return List.of();
        }
        Map<UUID, UsuarioId> usuarioPorCliente = usuariosDeClientes(ots);
        Map<UUID, Long> usuarioPorTecnico = usuariosDeTecnicos(ots);

        Set<UsuarioId> idsUsuarios = new LinkedHashSet<>(usuarioPorCliente.values());
        usuarioPorTecnico.values().forEach(usuarioId -> idsUsuarios.add(new UsuarioId(usuarioId)));
        Map<UsuarioId, String> nombres = usuarioRepository.buscarPorIds(idsUsuarios).stream()
                .collect(Collectors.toMap(Usuario::getUsuarioId, Usuario::getNombre, (a, b) -> a));

        List<OtResumenResponse> resumen = new ArrayList<>(ots.size());
        for (OtResponse ot : ots) {
            UsuarioId usuarioCliente = ot.clienteId() == null ? null
                    : usuarioPorCliente.get(ot.clienteId().valor());
            Long usuarioTecnico = ot.tecnicoId() == null ? null
                    : usuarioPorTecnico.get(ot.tecnicoId().valor());
            resumen.add(new OtResumenResponse(ot,
                    usuarioCliente == null ? null : nombres.get(usuarioCliente),
                    usuarioTecnico == null ? null : nombres.get(new UsuarioId(usuarioTecnico))));
        }
        return resumen;
    }

    private Map<UUID, UsuarioId> usuariosDeClientes(List<OtResponse> ots) {
        List<ClienteId> ids = ots.stream()
                .map(OtResponse::clienteId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        return clienteRepository.buscarPorIds(ids).stream()
                .collect(Collectors.toMap(cliente -> cliente.getId().valor(),
                        com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente::getUsuarioId,
                        (primero, segundo) -> primero));
    }

    private Map<UUID, Long> usuariosDeTecnicos(List<OtResponse> ots) {
        List<TecnicoId> ids = ots.stream()
                .map(OtResponse::tecnicoId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        return tecnicoRepository.buscarPorIds(ids).stream()
                .collect(Collectors.toMap(tecnico -> tecnico.getId().valor(),
                        com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico::getUsuarioId,
                        (primero, segundo) -> primero));
    }
}
