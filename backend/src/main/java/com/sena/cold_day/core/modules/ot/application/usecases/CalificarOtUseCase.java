package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@Service
public class CalificarOtUseCase {

    private final ClienteRepository clienteRepository;
    private final OtRepository otRepository;
    private final Clock clock;

    public CalificarOtUseCase(ClienteRepository clienteRepository, OtRepository otRepository, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.otRepository = otRepository;
        this.clock = clock;
    }

    @Transactional
    public OtResponse calificar(UsuarioId usuarioId, OtId otId, int estrellas, String comentario) {
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        if (!cliente.getId().equals(ot.getClienteId())) {
            throw new OtAccesoNoPermitidoException(otId);
        }
        ot.calificar(estrellas, comentario, clock.instant());
        return OtResponse.fromDomain(otRepository.save(ot));
    }
}
