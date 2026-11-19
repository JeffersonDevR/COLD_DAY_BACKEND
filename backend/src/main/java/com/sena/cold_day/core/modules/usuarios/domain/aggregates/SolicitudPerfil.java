package com.sena.cold_day.core.modules.usuarios.domain.aggregates;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;

import com.sena.cold_day.core.modules.usuarios.domain.exception.PerfilNoSolicitableException;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.EstadoSolicitudPerfil;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/**
 * Solicitud de cambio de perfil. El aggregate solo conoce el destino y la
 * motivacion; la adopcion efectiva la hace un administrador ya aprobada, sin
 * mutar nunca {@code usuario.rol} (las capacidades salen de las filas de perfil).
 */
public class SolicitudPerfil {

    private static final Set<Rol> PERFILES_CONMUTABLES = Set.of(Rol.CLIENTE, Rol.TECNICO);

    private Long id;
    private Long usuarioId;
    private Rol perfilDeseado;
    private EstadoSolicitudPerfil estado;
    private String motivacion;
    private Instant creadaEn;
    private Instant resueltaEn;
    private String motivoRechazo;

    private SolicitudPerfil() {
    }

    /**Crea una solicitud PENDIENTE validando que el destino sea conmutable y distinto del rol inicial.*/
    public static SolicitudPerfil crear(Long usuarioId, Rol perfilDeseado, Rol rolPrimario, String motivacion) {
        if (usuarioId == null) {
            throw new IllegalArgumentException("usuarioId requerido");
        }
        if (perfilDeseado == null || !PERFILES_CONMUTABLES.contains(perfilDeseado)) {
            throw new PerfilNoSolicitableException();
        }
        if (perfilDeseado == rolPrimario) {
            throw new PerfilNoSolicitableException();
        }
        return reconstituir(null, usuarioId, perfilDeseado, EstadoSolicitudPerfil.PENDIENTE,
                validarMotivacion(motivacion), Instant.now(), null, null);
    }

    /** Rehidratacion desde persistencia: el mapeo 1:1 la hace {@code SolicitudPerfilJpaEntity}. */
    public static SolicitudPerfil reconstituir(Long id, Long usuarioId, Rol perfilDeseado,
            EstadoSolicitudPerfil estado, String motivacion, Instant creadaEn,
            Instant resueltaEn, String motivoRechazo) {
        SolicitudPerfil solicitud = new SolicitudPerfil();
        solicitud.id = id;
        solicitud.usuarioId = Objects.requireNonNull(usuarioId, "usuarioId requerido");
        solicitud.perfilDeseado = Objects.requireNonNull(perfilDeseado, "perfilDeseado requerido");
        solicitud.estado = Objects.requireNonNull(estado, "estado requerido");
        solicitud.motivacion = Objects.requireNonNull(motivacion, "motivacion requerida");
        solicitud.creadaEn = creadaEn;
        solicitud.resueltaEn = resueltaEn;
        solicitud.motivoRechazo = motivoRechazo;
        return solicitud;
    }

    private static String validarMotivacion(String motivacion) {
        if (motivacion == null || motivacion.isBlank() || motivacion.length() > 1000) {
            throw new IllegalArgumentException("motivacion requerida (maximo 1000 caracteres)");
        }
        return motivacion;
    }

    public boolean estaResuelta() {
        return estado != EstadoSolicitudPerfil.PENDIENTE;
    }

    public void aprobar(Instant ahora) {
        this.estado = EstadoSolicitudPerfil.APROBADA;
        this.resueltaEn = ahora;
        this.motivoRechazo = null;
    }

    public void rechazar(String motivoRechazo, Instant ahora) {
        this.estado = EstadoSolicitudPerfil.RECHAZADA;
        this.resueltaEn = ahora;
        this.motivoRechazo = motivoRechazo;
    }

    public Long getId() { return id; }
    public Long getUsuarioId() { return usuarioId; }
    public Rol getPerfilDeseado() { return perfilDeseado; }
    public EstadoSolicitudPerfil getEstado() { return estado; }
    public String getMotivacion() { return motivacion; }
    public Instant getCreadaEn() { return creadaEn; }
    public Instant getResueltaEn() { return resueltaEn; }
    public String getMotivoRechazo() { return motivoRechazo; }
}
