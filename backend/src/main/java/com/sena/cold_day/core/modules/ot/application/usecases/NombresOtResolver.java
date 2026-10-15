package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
     * Enriches a whole listing. The resolved names are memoized across the batch,
     * so a list where many orders share a client or a technician resolves that
     * profile once instead of once per row.
     */
    public List<OtResumenResponse> enriquecer(List<OtResponse> ots) {
        Map<UUID, String> nombresClientes = new HashMap<>();
        Map<UUID, String> nombresTecnicos = new HashMap<>();
        List<OtResumenResponse> resumen = new ArrayList<>();
        for (OtResponse ot : ots) {
            String clienteNombre = ot.clienteId() == null ? null
                    : nombresClientes.computeIfAbsent(ot.clienteId().valor(),
                            id -> nombreCliente(new ClienteId(id)));
            String tecnicoNombre = ot.tecnicoId() == null ? null
                    : nombresTecnicos.computeIfAbsent(ot.tecnicoId().valor(),
                            id -> nombreTecnico(TecnicoId.desde(id)));
            resumen.add(new OtResumenResponse(ot, clienteNombre, tecnicoNombre));
        }
        return resumen;
    }
}
