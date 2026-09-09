package com.sena.cold_day.core.modules.tecnicos.domain.aggregates;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

/** Aggregate root for the technician profile and its owned value objects. */
public class Tecnico {

    private Long id;
    private String numeroIdentificacion;
    private String nombres;
    private String apellidos;
    private String telefono;
    private String email;
    private String fotoUrl;
    private final Set<CategoriaServicio> categoriasServicio = new HashSet<>();
    private EstadoOperativo estadoOperativo;
    private final Set<Certificacion> certificaciones = new HashSet<>();
    private boolean activo = true;

    private Tecnico() {
    }

    public static Tecnico crear(String numeroIdentificacion, String nombres, String apellidos, String telefono,
            String email, String fotoUrl, Set<CategoriaServicio> categoriasServicio,
            Set<Certificacion> certificaciones) {
        Tecnico tecnico = new Tecnico();
        tecnico.actualizarPerfil(numeroIdentificacion, nombres, apellidos, telefono, email, fotoUrl);
        tecnico.reemplazarCategorias(categoriasServicio);
        tecnico.reemplazarCertificaciones(certificaciones);
        tecnico.estadoOperativo = EstadoOperativo.DISPONIBLE;
        return tecnico;
    }

    public static Tecnico reconstituir(Long id, String numeroIdentificacion, String nombres, String apellidos,
            String telefono, String email, String fotoUrl, Set<CategoriaServicio> categoriasServicio,
            EstadoOperativo estadoOperativo, Set<Certificacion> certificaciones, boolean activo) {
        Tecnico tecnico = crear(numeroIdentificacion, nombres, apellidos, telefono, email, fotoUrl,
                categoriasServicio, certificaciones);
        tecnico.id = id;
        tecnico.estadoOperativo = estadoOperativo;
        tecnico.activo = activo;
        return tecnico;
    }

    public void actualizarPerfil(String numeroIdentificacion, String nombres, String apellidos, String telefono,
            String email, String fotoUrl) {
        this.numeroIdentificacion = numeroIdentificacion;
        this.nombres = nombres;
        this.apellidos = apellidos;
        this.telefono = telefono;
        this.email = email;
        this.fotoUrl = fotoUrl;
    }

    public void cambiarEstado(EstadoOperativo nuevoEstadoOperativo) {
        if (estadoOperativo == EstadoOperativo.OCUPADO) {
            throw new TecnicoAsignadoException(numeroIdentificacion);
        }
        this.estadoOperativo = nuevoEstadoOperativo;
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

    public boolean esActivo() { return activo; }
    public boolean isActivo() { return activo; }
    public Long getId() { return id; }
    public String getNumeroIdentificacion() { return numeroIdentificacion; }
    public String getNombres() { return nombres; }
    public String getApellidos() { return apellidos; }
    public String getTelefono() { return telefono; }
    public String getEmail() { return email; }
    public String getFotoUrl() { return fotoUrl; }
    public Set<CategoriaServicio> getCategoriasServicio() { return Collections.unmodifiableSet(categoriasServicio); }
    public EstadoOperativo getEstadoOperativo() { return estadoOperativo; }
    public Set<Certificacion> getCertificaciones() { return Collections.unmodifiableSet(certificaciones); }
}
