package com.sena.cold_day.core.modules.usuarios.domain.repository;

import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.SolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/** Puerto de persistencia de solicitudes de cambio de perfil (adaptador JPA). */
public interface SolicitudPerfilRepository {

    SolicitudPerfil save(SolicitudPerfil solicitud);

    Optional<SolicitudPerfil> buscarPorId(Long id);

    boolean existePendiente(Long usuarioId, Rol perfilDeseado);

    /** Bandeja admin: ventana limitada, ordenada por fecha descendente (BE-P1). */
    List<SolicitudPerfil> listar(int limite, int offset);
}
