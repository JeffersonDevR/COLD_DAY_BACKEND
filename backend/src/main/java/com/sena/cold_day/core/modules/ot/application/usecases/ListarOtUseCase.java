package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.application.dto.OtResumenResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Read paths to list OTs: global (admin), by the authenticated cliente, or by
 * the authenticated técnico. Resolves the profile from the principal and
 * enriches each row with the cliente/técnico display names through
 * {@link NombresOtResolver}, which the detail and mutation paths share.
 */
@Service
public class ListarOtUseCase {

    private final OtRepository otRepository;
    private final ClienteRepository clienteRepository;
    private final TecnicoRepository tecnicoRepository;
    private final NombresOtResolver nombres;

    public ListarOtUseCase(OtRepository otRepository, ClienteRepository clienteRepository,
            TecnicoRepository tecnicoRepository, NombresOtResolver nombres) {
        this.otRepository = otRepository;
        this.clienteRepository = clienteRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.nombres = nombres;
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
        return nombres.enriquecer(ots.stream().map(OtResponse::fromDomain).toList());
    }
}
