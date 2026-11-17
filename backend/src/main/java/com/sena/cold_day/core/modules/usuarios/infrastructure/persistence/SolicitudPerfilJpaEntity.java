package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import java.time.Instant;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.SolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.EstadoSolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "solicitud_perfil")
@Getter
@Setter
@NoArgsConstructor
public class SolicitudPerfilJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Enumerated(EnumType.STRING)
    @Column(name = "perfil_deseado", nullable = false, length = 20)
    private Rol perfilDeseado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoSolicitudPerfil estado;

    @Column(nullable = false, length = 1000)
    private String motivacion;

    @Column(name = "creada_en", nullable = false)
    private Instant creadaEn;

    @Column(name = "resuelta_en")
    private Instant resueltaEn;

    @Column(name = "motivo_rechazo", length = 500)
    private String motivoRechazo;

    public static SolicitudPerfilJpaEntity fromDomain(SolicitudPerfil solicitud) {
        SolicitudPerfilJpaEntity target = new SolicitudPerfilJpaEntity();
        target.id = solicitud.getId();
        target.usuarioId = solicitud.getUsuarioId();
        target.perfilDeseado = solicitud.getPerfilDeseado();
        target.estado = solicitud.getEstado();
        target.motivacion = solicitud.getMotivacion();
        target.creadaEn = solicitud.getCreadaEn();
        target.resueltaEn = solicitud.getResueltaEn();
        target.motivoRechazo = solicitud.getMotivoRechazo();
        return target;
    }

    public SolicitudPerfil toDomain() {
        return SolicitudPerfil.reconstituir(id, usuarioId, perfilDeseado, estado, motivacion,
                creadaEn, resueltaEn, motivoRechazo);
    }
}
