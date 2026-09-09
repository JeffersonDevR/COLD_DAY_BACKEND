package com.sena.cold_day.core.modules.tecnicos.domain.aggregates;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoValidadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;

/**
 * Aggregate root for the technician profile. Identity lives in the Usuario
 * aggregate (referenced by usuarioId, never inherited) while this aggregate
 * owns the business profile and its state machines.
 */
public class Tecnico {

    private Long id;
    private Long usuarioId;
    private String numeroIdentificacion;
    private String fotoUrl;
    private final Set<CategoriaServicio> categoriasServicio = new HashSet<>();
    private EstadoOperativo estadoOperativo;
    private EstadoValidacion estadoValidacion;
    private String motivoRechazoValidacion;
    private final Set<Certificacion> certificaciones = new HashSet<>();
    private boolean activo = true;

    private Tecnico() {
    }

    /**
     * Alta: always born PENDIENTE and FUERA_DE_SERVICIO — cannot operate
     * until the administrator approves its documents (CU-03).
     */
    public static Tecnico crear(Long usuarioId, String numeroIdentificacion, String fotoUrl,
            Set<CategoriaServicio> categoriasServicio, Set<Certificacion> certificaciones) {
        Tecnico tecnico = new Tecnico();
        tecnico.usuarioId = usuarioId;
        tecnico.actualizarPerfil(numeroIdentificacion, fotoUrl);
        tecnico.reemplazarCategorias(categoriasServicio);
        tecnico.reemplazarCertificaciones(certificaciones);
        tecnico.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
        tecnico.estadoValidacion = EstadoValidacion.PENDIENTE;
        tecnico.activo = true;
        return tecnico;
    }

    public static Tecnico reconstituir(Long id, Long usuarioId, String numeroIdentificacion, String fotoUrl,
            Set<CategoriaServicio> categoriasServicio, EstadoOperativo estadoOperativo,
            EstadoValidacion estadoValidacion, String motivoRechazoValidacion, Set<Certificacion> certificaciones,
            boolean activo) {
        Tecnico tecnico = crear(usuarioId, numeroIdentificacion, fotoUrl, categoriasServicio, certificaciones);
        tecnico.id = id;
        tecnico.estadoOperativo = estadoOperativo;
        tecnico.estadoValidacion = estadoValidacion;
        tecnico.motivoRechazoValidacion = motivoRechazoValidacion;
        tecnico.activo = activo;
        return tecnico;
    }

    public void actualizarPerfil(String numeroIdentificacion, String fotoUrl) {
        this.numeroIdentificacion = numeroIdentificacion;
        this.fotoUrl = fotoUrl;
    }

    /**
     * Invoked by ValidarDocumentacionTecnicoUseCase when the administrator
     * approves the documents (CU-03, step 3). Remains FUERA_DE_SERVICIO until
     * the tecnico himself flips the switch (CU-07).
     */
    public void aprobarValidacion() {
        this.estadoValidacion = EstadoValidacion.APROBADO;
        this.motivoRechazoValidacion = null;
    }

    /** Invoked when the administrator rejects the documents (CU-03, 2a). */
    public void rechazarValidacion(String motivo) {
        this.estadoValidacion = EstadoValidacion.RECHAZADO;
        this.motivoRechazoValidacion = motivo;
        this.estadoOperativo = EstadoOperativo.FUERA_DE_SERVICIO;
    }

    /** Central guard: no operative transition while validation is not APROBADO (CU-03 + CU-07). */
    public void cambiarEstado(EstadoOperativo nuevoEstadoOperativo) {
        if (estadoValidacion != EstadoValidacion.APROBADO) {
            throw new TecnicoNoValidadoException(id, estadoValidacion);
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

    public boolean isActivo() { return activo; }
    public Long getId() { return id; }
    public Long getUsuarioId() { return usuarioId; }
    public String getNumeroIdentificacion() { return numeroIdentificacion; }
    public String getFotoUrl() { return fotoUrl; }
    public Set<CategoriaServicio> getCategoriasServicio() { return Collections.unmodifiableSet(categoriasServicio); }
    public EstadoOperativo getEstadoOperativo() { return estadoOperativo; }
    public EstadoValidacion getEstadoValidacion() { return estadoValidacion; }
    public String getMotivoRechazoValidacion() { return motivoRechazoValidacion; }
    public Set<Certificacion> getCertificaciones() { return Collections.unmodifiableSet(certificaciones); }
}
