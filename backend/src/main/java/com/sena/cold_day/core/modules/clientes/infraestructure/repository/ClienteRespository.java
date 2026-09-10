package com.sena.cold_day.core.modules.clientes.infraestructure.repository;


import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public interface ClienteRespository {

    Cliente save(Cliente cliente);
    List<Cliente> findByACtivoTrue();
    Optional<Cliente> findByActivo(ClienteId id);
    Optional<Cliente> findByUsuarioId(UsuarioId usuarioId);
    void deleteAll();




}
