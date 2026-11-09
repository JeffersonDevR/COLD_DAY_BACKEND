package com.sena.cold_day.core.modules.clientes.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.infrastructure.persistence.ClienteJpaEntity;
import com.sena.cold_day.core.modules.clientes.infrastructure.persistence.SpringDataClienteRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@Repository
public class ClienteRepositoryAdapter implements ClienteRepository {

    private final SpringDataClienteRepository repository;

    public ClienteRepositoryAdapter(SpringDataClienteRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public Cliente save(Cliente cliente) {
        return repository.saveAndFlush(ClienteJpaEntity.fromDomain(cliente)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Cliente> findByUsuarioId(UsuarioId usuarioId) {
        return repository.findByUsuarioId(usuarioId.valor()).map(ClienteJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Cliente> buscarPorId(ClienteId id) {
        return repository.findById(id.valor()).map(ClienteJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Cliente> buscarPorIds(java.util.Collection<ClienteId> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<java.util.UUID> valores = ids.stream().filter(id -> id != null).map(ClienteId::valor).toList();
        if (valores.isEmpty()) {
            return List.of();
        }
        // Sin filtro de activo a proposito: preserva la semantica de
        // `buscarPorId`, que tampoco filtraba (el nombre del cliente de una OT
        // historica sigue resolviendose aunque el perfil se haya desactivado).
        return repository.findByIdIn(valores).stream().map(ClienteJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Cliente> findByActivoTrue() {
        return repository.findByActivoTrue().stream().map(ClienteJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional
    public void deleteAll() {
        repository.deleteAll();
    }
}
