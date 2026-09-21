package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.application.dto.OtResumenResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Read paths to list OTs: global (admin), by the authenticated cliente, or by
 * the authenticated técnico. Resolves the profile from the principal and
 * enriches each row with the cliente/técnico display names.
 */
@Service
public class ListarOtUseCase {

    private final OtRepository otRepository;
    private final ClienteRepository clienteRepository;
    private final TecnicoRepository tecnicoRepository;
    private final UsuarioRepository usuarioRepository;

    public ListarOtUseCase(OtRepository otRepository, ClienteRepository clienteRepository,
            TecnicoRepository tecnicoRepository, UsuarioRepository usuarioRepository) {
        this.otRepository = otRepository;
        this.clienteRepository = clienteRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<OtResumenResponse> listarTodas() {
        return enriquecer(otRepository.listarTodas());
    }

    @Transactional(readOnly = true)
    public List<OtResumenResponse> listarPorCliente(UsuarioId usuarioId) {
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
        return enriquecer(otRepository.buscarPorCliente(cliente.getId()));
    }

    @Transactional(readOnly = true)
    public List<OtResumenResponse> listarPorTecnico(UsuarioId usuarioId) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        return enriquecer(otRepository.buscarPorTecnico(tecnico.getId()));
    }

    private List<OtResumenResponse> enriquecer(List<Ot> ots) {
        Map<UUID, String> nombresClientes = new HashMap<>();
        Map<UUID, String> nombresTecnicos = new HashMap<>();
        List<OtResumenResponse> resumen = new ArrayList<>();
        for (Ot ot : ots) {
            String clienteNombre = ot.getClienteId() == null ? null
                    : nombresClientes.computeIfAbsent(ot.getClienteId().valor(), this::nombreCliente);
            String tecnicoNombre = ot.getTecnicoId() == null ? null
                    : nombresTecnicos.computeIfAbsent(ot.getTecnicoId().valor(), this::nombreTecnico);
            resumen.add(new OtResumenResponse(OtResponse.fromDomain(ot), clienteNombre, tecnicoNombre));
        }
        return resumen;
    }

    private String nombreCliente(UUID clienteId) {
        return clienteRepository.buscarPorId(new ClienteId(clienteId))
                .flatMap(cliente -> usuarioRepository.buscarPorId(cliente.getUsuarioId()))
                .map(Usuario::getNombre)
                .orElse(null);
    }

    private String nombreTecnico(UUID tecnicoId) {
        return tecnicoRepository.findByIdAndActivoTrue(TecnicoId.desde(tecnicoId))
                .flatMap(tecnico -> usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId())))
                .map(Usuario::getNombre)
                .orElse(null);
    }
}
