package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.EstadoSolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

public interface SpringDataSolicitudPerfilRepository extends JpaRepository<SolicitudPerfilJpaEntity, Long> {

    boolean existsByUsuarioIdAndPerfilDeseadoAndEstado(
            Long usuarioId, Rol perfilDeseado, EstadoSolicitudPerfil estado);
}
