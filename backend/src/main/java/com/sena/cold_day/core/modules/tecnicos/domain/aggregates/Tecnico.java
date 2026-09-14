package com.sena.cold_day.core.modules.tecnicos.domain.aggregates;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.DocumentacionIncompletaException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoValidadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

public class Tecnico {


    private TecnicoId id;
    private Long usuarioId;
    private String numeroIdentificacion;
    private final Set<CategoriaServicio> categoriasServicio = new HashSet<>();
    private EstadoOperativo estadoOperativo;
    private EstadoValidacion estadoValidacion;
    private String motivoRechazoValidacion;
    private final Set<Certificacion> certificaciones = new HashSet<>();
    private boolean activo = true;
    private Point ubicacion;
    private boolean trackingActivo;
    private Instant ubicacionActualizadaEn;

    private Tecnico() {
    }


    public static Tecnico crear(Long usuarioId, String numeroIdentificacion,
            Set<CategoriaServicio> categoriasServicio, Set<Certificacion> certificaciones) {
        Tecnico tecnico = new Tecnico();
        tecnico.id = TecnicoId.nueva();
        tecnico.usuarioId = usuarioId;
        tecnico.actualizarPerfil(numeroIdentificacion);
        tecnico.reemplazarCategorias(categoriasServicio);
        tecnico.reemplazarCertificaciones(certificaciones);
        tecnico.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
        tecnico.estadoValidacion = EstadoValidacion.PENDIENTE;
        tecnico.activo = true;
        return tecnico;
    }

    public static Tecnico reconstituir(TecnicoId id, Long usuarioId, String numeroIdentificacion,
                                       Set<CategoriaServicio> categoriasServicio, EstadoOperativo estadoOperativo,
                                       EstadoValidacion estadoValidacion, String motivoRechazoValidacion, Set<Certificacion> certificaciones,
                                       boolean activo, Point ubicacion, boolean trackingActivo, Instant ubicacionActualizadaEn) {

        Tecnico tecnico = crear(usuarioId, numeroIdentificacion, categoriasServicio, certificaciones);
        tecnico.id = id;
        tecnico.estadoOperativo = estadoOperativo;
        tecnico.estadoValidacion = estadoValidacion;
        tecnico.motivoRechazoValidacion = motivoRechazoValidacion;
        tecnico.activo = activo;
        tecnico.ubicacion = ubicacion;
        tecnico.trackingActivo = trackingActivo;
        tecnico.ubicacionActualizadaEn = ubicacionActualizadaEn;
        return tecnico;
    }

    public void actualizarPerfil(String numeroIdentificacion) {
        this.numeroIdentificacion = numeroIdentificacion;
    }


    /**
     * Approves documentary validation only when every certification is still
     * vigente (RF-F1-03). Document vigencia is enforced by the use case, which
     * owns the document repository.
     */
    public void aprobarValidacion(LocalDate hoy) {
        boolean certificacionesVigentes = certificaciones.stream()
                .allMatch(certificacion -> certificacion.estaVigente(hoy));
        if (!certificacionesVigentes) {
            throw new DocumentacionIncompletaException(id);
        }
        this.estadoValidacion = EstadoValidacion.APROBADO;
        this.motivoRechazoValidacion = null;
    }

    /** A document expired unrenewed: habilitation is suspended and the technician leaves service. */
    public void suspenderPorVencimiento() {
        this.estadoValidacion = EstadoValidacion.SUSPENDIDO;
        this.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
    }


    public void rechazarValidacion(String motivo) {
        this.estadoValidacion = EstadoValidacion.RECHAZADO;
        this.motivoRechazoValidacion = motivo;
        this.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
    }


    public void cambiarEstado(EstadoOperativo nuevoEstadoOperativo) {
        if (estadoValidacion != EstadoValidacion.APROBADO) {
            throw new TecnicoNoValidadoException(id,estadoValidacion );
        }
        if (estadoOperativo == EstadoOperativo.OCUPADO) {
            throw new TecnicoAsignadoException(numeroIdentificacion);
        }
        this.estadoOperativo = nuevoEstadoOperativo;
    }

    /** Same guard applies before accepting an order (CU-08, step 4). */
    public void aceptarOrden() {
        if (estadoValidacion != EstadoValidacion.APROBADO) {
            throw new TecnicoNoValidadoException(id, estadoValidacion);
        }
        if (estadoOperativo != EstadoOperativo.DISPONIBLE) {
            throw new TecnicoAsignadoException(numeroIdentificacion);
        }
        this.estadoOperativo = EstadoOperativo.OCUPADO;
    }

    /**
     * Releases the assigned order when its OT reaches a terminal state or is
     * reassigned. An approved technician returns from {@code OCUPADO} to
     * {@code DISPONIBLE}; a technician whose validation is no longer
     * {@code APROBADO} (for example, suspended) is deliberately left untouched
     * so a terminal OT never makes an ineligible technician available.
     */
    public void liberarOrden() {
        if (estadoValidacion == EstadoValidacion.APROBADO && estadoOperativo == EstadoOperativo.OCUPADO) {
            this.estadoOperativo = EstadoOperativo.DISPONIBLE;
        }
    }

    public void reemplazarCategorias(Set<CategoriaServicio> categorias) {
        categoriasServicio.clear();
        if (categorias != null) {
            categoriasServicio.addAll(categorias);
        }
    }

    public void reemplazarCertificaciones(Set<Certificacion> certificaciones) {
        this.certificaciones.clear();
        if (certificaciones != null) {
            this.certificaciones.addAll(certificaciones);
        }
    }

    public void agregarCertificacion(Certificacion certificacion) {
        certificaciones.add(certificacion);
    }

    public void eliminarCertificacion(Certificacion certificacion) {
        certificaciones.remove(certificacion);
    }

    public void desactivar() {
        activo = false;
    }

    /**
     * Captures a new coordinate and (re)activates real-time tracking (RF-F1-06).
     * Range validation lives in {@link Point}.
     */
    public void actualizarUbicacion(Point ubicacion, Instant ahora) {
        if (ubicacion == null) {
            throw new IllegalArgumentException("La ubicacion es requerida");
        }
        if (ahora == null) {
            throw new IllegalArgumentException("El momento de actualizacion es requerido");
        }
        this.ubicacion = ubicacion;
        this.ubicacionActualizadaEn = ahora;
        this.trackingActivo = true;
    }

    /**
     * Terminal OT states stop real-time tracking while the final coordinates
     * remain persisted for audit (RF-F1-27, design D9).
     */
    public void desactivarTracking() {
        this.trackingActivo = false;
    }

    public void activarTracking() {
        this.trackingActivo = true;
    }

    public boolean isActivo() { return activo; }
    public Point getUbicacion() { return ubicacion; }
    public boolean isTrackingActivo() { return trackingActivo; }
    public Instant getUbicacionActualizadaEn() { return ubicacionActualizadaEn; }
    public TecnicoId getId() { return id; }
    public Long getUsuarioId() { return usuarioId; }
    public String getNumeroIdentificacion() { return numeroIdentificacion; }
    public Set<CategoriaServicio> getCategoriasServicio() { return Collections.unmodifiableSet(categoriasServicio); }
    public EstadoOperativo getEstadoOperativo() { return estadoOperativo; }
    public EstadoValidacion getEstadoValidacion() { return estadoValidacion; }
    public String getMotivoRechazoValidacion() { return motivoRechazoValidacion; }
    public Set<Certificacion> getCertificaciones() { return Collections.unmodifiableSet(certificaciones); }
}
