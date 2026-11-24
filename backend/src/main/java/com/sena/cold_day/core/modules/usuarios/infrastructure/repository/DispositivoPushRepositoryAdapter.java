package com.sena.cold_day.core.modules.usuarios.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.DispositivoPush;
import com.sena.cold_day.core.modules.usuarios.domain.repository.DispositivoPushRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.DispositivoPushJpaEntity;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataDispositivoPushRepository;

@Component
public class DispositivoPushRepositoryAdapter implements DispositivoPushRepository {

    private final SpringDataDispositivoPushRepository springData;

    public DispositivoPushRepositoryAdapter(SpringDataDispositivoPushRepository springData) {
        this.springData = springData;
    }

    @Override
    public DispositivoPush save(DispositivoPush dispositivo) {
        return springData.save(DispositivoPushJpaEntity.fromDomain(dispositivo)).toDomain();
    }

    @Override
    public void registrar(Long usuarioId, String token, String plataforma) {
        springData.upsert(usuarioId, token, plataforma);
    }

    @Override
    public Optional<DispositivoPush> buscarPorToken(String token) {
        return springData.findByToken(token).map(DispositivoPushJpaEntity::toDomain);
    }

    @Override
    public List<DispositivoPush> listarPorUsuario(Long usuarioId, int limite) {
        return springData.findByUsuarioIdOrderByActualizadoEnDesc(usuarioId, PageRequest.of(0, limite))
                .stream().map(DispositivoPushJpaEntity::toDomain).toList();
    }

    @Override
    public int eliminar(Long usuarioId, String token) {
        return springData.eliminar(usuarioId, token);
    }
}
