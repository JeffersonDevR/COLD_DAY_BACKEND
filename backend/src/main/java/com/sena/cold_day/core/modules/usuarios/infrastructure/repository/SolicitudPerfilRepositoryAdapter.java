package com.sena.cold_day.core.modules.usuarios.infrastructure.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.SolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.repository.SolicitudPerfilRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.EstadoSolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SolicitudPerfilJpaEntity;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataSolicitudPerfilRepository;

@Component
public class SolicitudPerfilRepositoryAdapter implements SolicitudPerfilRepository {

    private final SpringDataSolicitudPerfilRepository springData;

    public SolicitudPerfilRepositoryAdapter(SpringDataSolicitudPerfilRepository springData) {
        this.springData = springData;
    }

    @Override
    public SolicitudPerfil save(SolicitudPerfil solicitud) {
        return springData.save(SolicitudPerfilJpaEntity.fromDomain(solicitud)).toDomain();
    }

    @Override
    public Optional<SolicitudPerfil> buscarPorId(Long id) {
        return springData.findById(id).map(SolicitudPerfilJpaEntity::toDomain);
    }

    @Override
    public boolean existePendiente(Long usuarioId, Rol perfilDeseado) {
        return springData.existsByUsuarioIdAndPerfilDeseadoAndEstado(
                usuarioId, perfilDeseado, EstadoSolicitudPerfil.PENDIENTE);
    }

    @Override
    public List<SolicitudPerfil> listar(int limite, int offset) {
        int pagina = offset / limite;
        var orden = Sort.by(Sort.Direction.DESC, "creadaEn");
        return springData.findAll(PageRequest.of(pagina, limite, orden)).stream()
                .map(SolicitudPerfilJpaEntity::toDomain).toList();
    }
}
