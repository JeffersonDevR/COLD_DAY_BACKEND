package com.sena.cold_day.core.modules.geolocalizacion.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.exception.ClienteNoEncontradoException;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Captures the authenticated client's coordinates (RF-F1-06), preserving the
 * textual address. The profile is resolved from the principal, never from the
 * body. Range validation is enforced by {@link Point}.
 */
@Service
public class ActualizarUbicacionClienteUseCase {

    private final ClienteRepository clienteRepository;

    public ActualizarUbicacionClienteUseCase(ClienteRepository clienteRepository) {
        this.clienteRepository = clienteRepository;
    }

    @Transactional
    public void actualizar(UsuarioId usuarioId, Point ubicacion) {
        Cliente cliente = clienteRepository.findByUsuarioId(usuarioId)
                .orElseThrow(() -> new ClienteNoEncontradoException(
                        "No existe un perfil de cliente para el usuario: " + usuarioId.valor()));
        cliente.actualizarUbicacion(ubicacion);
        clienteRepository.save(cliente);
    }
}
