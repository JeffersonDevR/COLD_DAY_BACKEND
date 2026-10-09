package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OfertaTecnicoResumen;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-09: the authenticated technician polls the offers still open to it. The
 * profile is resolved from the principal, and closed windows are excluded so a
 * stale {@code PENDIENTE} row that the sweep has not resolved yet is never
 * presented as actionable (design D6 lazy check).
 *
 * <p>Each live offer is composed with a reduced view of its order and the
 * client's display name. The order is fetched in a single batch query (never a
 * per-offer loop): the whole point of this enrichment is to spare the client
 * the {@code GET /api/ot/{id}} call that a pending-offer holder is not
 * authorized to make. An offer whose order cannot be resolved is returned with
 * a null order instead of failing the whole list.
 */
@Service
public class ListarOfertasTecnicoUseCase {

    private final OfertaOtRepository ofertaRepository;
    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public ListarOfertasTecnicoUseCase(OfertaOtRepository ofertaRepository,
            OtRepository otRepository,
            TecnicoRepository tecnicoRepository,
            ClienteRepository clienteRepository,
            UsuarioRepository usuarioRepository,
            Clock clock) {
        this.ofertaRepository = ofertaRepository;
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.clienteRepository = clienteRepository;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<OfertaTecnicoResumen> listar(UsuarioId usuarioId) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        Instant ahora = clock.instant();
        List<OfertaOt> ofertas = ofertaRepository.listarPorTecnico(tecnico.getId(), OfertaEstado.PENDIENTE)
                .stream()
                .filter(oferta -> oferta.estaVigente(ahora))
                .toList();
        if (ofertas.isEmpty()) {
            return List.of();
        }

        Map<UUID, Ot> ordenes = otRepository.buscarPorIds(
                ofertas.stream().map(OfertaOt::getOtId).filter(otId -> otId != null).distinct().toList())
                .stream()
                .collect(Collectors.toMap(ot -> ot.getId().valor(), ot -> ot, (primero, repetido) -> primero));

        Map<UUID, String> nombresClientes = new HashMap<>();
        List<OfertaTecnicoResumen> resumen = new ArrayList<>(ofertas.size());
        for (OfertaOt oferta : ofertas) {
            Ot ot = oferta.getOtId() == null ? null : ordenes.get(oferta.getOtId().valor());
            if (ot == null) {
                // Honest degradation: keep the offer visible without its order
                // rather than failing the whole list. The wire layer serializes
                // a null nested summary and the client renders only offers that
                // carry an order.
                resumen.add(new OfertaTecnicoResumen(oferta, null, null));
                continue;
            }
            String clienteNombre = ot.getClienteId() == null ? null
                    : nombresClientes.computeIfAbsent(ot.getClienteId().valor(), this::nombreCliente);
            resumen.add(new OfertaTecnicoResumen(oferta, OtResponse.fromDomain(ot), clienteNombre));
        }
        return resumen;
    }

    private String nombreCliente(UUID clienteId) {
        return clienteRepository.buscarPorId(new ClienteId(clienteId))
                .flatMap(cliente -> usuarioRepository.buscarPorId(cliente.getUsuarioId()))
                .map(Usuario::getNombre)
                .orElse(null);
    }
}
