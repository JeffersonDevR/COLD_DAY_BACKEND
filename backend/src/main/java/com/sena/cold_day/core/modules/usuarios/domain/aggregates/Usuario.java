package com.sena.cold_day.core.modules.usuarios.domain.aggregates;

import java.time.LocalDateTime;
import java.util.Objects;

import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Aggregate root for identity/authentication. It never references business
 * roles (Tecnico, Cliente, ...) — dependency is one way: roles reference
 * UsuarioId. The rol is classification data, not class inheritance.
 */
public class Usuario {

    private Long id;
    private String nombre;
    private String correo;
    private String passwordHash;
    private String telefono;
    private String fotoUrl;
    private Rol rol;
    private LocalDateTime fechaRegistro;
    private boolean habeasDataAceptado;
    private boolean activo;

    private Usuario() {
    }

    /** Valid creation transition (alta). Rol is fixed once, immutable afterwards. */
    public static Usuario registrar(String nombre, String correo, String passwordPlano,
            String telefono, String fotoUrl, Rol rol, PasswordEncoderPort encoder) {
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("nombre requerido");
        }
        if (correo == null || !correo.contains("@")) {
            throw new IllegalArgumentException("correo invalido");
        }
        if (rol == null) {
            throw new IllegalArgumentException("rol requerido");
        }
        Usuario usuario = new Usuario();
        usuario.nombre = nombre;
        usuario.correo = correo;
        usuario.passwordHash = encoder.encode(passwordPlano);
        usuario.telefono = telefono;
        usuario.fotoUrl = fotoUrl;
        usuario.rol = rol;
        usuario.fechaRegistro = LocalDateTime.now();
        usuario.habeasDataAceptado = false;
        usuario.activo = true;
        return usuario;
    }

    /** Reconstitution from persistence. */
    public static Usuario reconstituir(Long id, String nombre, String correo, String passwordHash,
            String telefono, String fotoUrl, Rol rol, LocalDateTime fechaRegistro,
            boolean habeasDataAceptado, boolean activo) {
        Usuario usuario = new Usuario();
        usuario.id = Objects.requireNonNull(id, "id requerido");
        usuario.nombre = nombre;
        usuario.correo = correo;
        usuario.passwordHash = passwordHash;
        usuario.telefono = telefono;
        usuario.fotoUrl = fotoUrl;
        usuario.rol = rol;
        usuario.fechaRegistro = fechaRegistro;
        usuario.habeasDataAceptado = habeasDataAceptado;
        usuario.activo = activo;
        return usuario;
    }

    /**
     * Validates credentials only — issuing the token is the use case's job
     * (signing a JWT needs configuration that is not aggregate state).
     */
    public void verificarCredenciales(String passwordPlano, PasswordEncoderPort encoder) {
        if (!encoder.matches(passwordPlano, this.passwordHash)) {
            throw new CredencialesInvalidasException();
        }
    }

    /** The actual email delivery belongs to infrastructure. */
    public void recuperarContrasena() {
        if (!activo) {
            throw new IllegalStateException("Usuario inactivo no puede recuperar contrasena");
        }
    }

    public void aceptarHabeasData() {
        this.habeasDataAceptado = true;
    }

    public void actualizarPerfil(String nombre, String telefono, String fotoUrl) {
        if (nombre != null && !nombre.isBlank()) {
            this.nombre = nombre;
        }
        if (telefono != null) {
            this.telefono = telefono;
        }
        if (fotoUrl != null) {
            this.fotoUrl = fotoUrl;
        }
    }

    public Long getId() { return id; }
    public UsuarioId getUsuarioId() { return id == null ? null : new UsuarioId(id); }
    public String getNombre() { return nombre; }
    public String getCorreo() { return correo; }
    public String getTelefono() { return telefono; }
    public String getFotoUrl() { return fotoUrl; }
    public Rol getRol() { return rol; }
    public LocalDateTime getFechaRegistro() { return fechaRegistro; }
    public boolean isHabeasDataAceptado() { return habeasDataAceptado; }
    public boolean isActivo() { return activo; }
    public String getPasswordHash() { return passwordHash; }

    public void desactivar() { this.activo = false; }
}
