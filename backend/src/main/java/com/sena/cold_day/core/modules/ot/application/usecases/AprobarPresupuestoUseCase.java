package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtAccesoNoPermitidoException;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-20: the client that owns the OT approves the presented budget and the
 * order advances {@code EN_DIAGNOSTICO -> EN_REPARACION}. Only the owning
 * client may approve; anyone else receives a 403.
 */
@Service
public class AprobarPresupuestoUseCase {

    private final OtRepository otRepository;
    private final ClienteRepository clienteRepository;
    private final Clock clock;

    public AprobarPresupuestoUseCase(OtRepository otRepository, ClienteRepository clienteRepository,
            Clock clock) {
        this.otRepository = otRepository;
        this.clienteRepository = clienteRepository;
        this.clock = clock;
    }

    @Transactional
    public OtResponse aprobar(UsuarioId usuarioId, OtId otId) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
        if (!cliente.getId().equals(ot.getClienteId())) {
            throw new OtAccesoNoPermitidoException(otId);
        }
        ot.aprobarPresupuesto(ActorOt.CLIENTE, clock.instant());
        return OtResponse.fromDomain(otRepository.save(ot));
    }
}
