package com.sena.cold_day.core.modules.clientes.domain.repository;

import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Domain port for Cliente persistence. Replaces the misspelled infrastructure
 * interface {@code ClienteRespository} (baseline-health defect).
 */
public interface ClienteRepository {

    Cliente save(Cliente cliente);

    Optional<Cliente> findByUsuarioId(UsuarioId usuarioId);

    Optional<Cliente> buscarPorId(ClienteId id);

    List<Cliente> findByActivoTrue();

    void deleteAll();
}
