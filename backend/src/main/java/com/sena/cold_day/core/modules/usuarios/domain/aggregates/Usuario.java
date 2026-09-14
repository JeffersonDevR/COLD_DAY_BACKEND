package com.sena.cold_day.core.modules.usuarios.domain.aggregates;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Objects;

import com.sena.cold_day.core.modules.usuarios.domain.exception.CredencialesInvalidasException;
import com.sena.cold_day.core.modules.usuarios.domain.exception.HabeasDataRequeridoException;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;


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
    /**
     * Monotonic token generation counter (design D11). Issued JWTs carry it as
     * the {@code ver} claim; the authentication filter rejects tokens whose
     * version is below the persisted value, so bumping it revokes every token
     * issued before the bump.
     */
    private int tokenVersion;

    private Usuario() {

    }
    /**
     * Registration invariant: explicit Habeas Data consent is mandatory and is
     * persisted atomically with the new account. Absent consent fails before any
     * state is created.
     */
    @SuppressWarnings("java:S107") // Invariante de registro: los 7 datos + encoder y consentimiento son obligatorios y atomicos. Un comando introduciria una capa sin valor aqui; el caso de uso ya agrupa via UsuarioRequest.
    public static Usuario registrar(String nombre, String correo, String passwordPlano,
            String telefono, String fotoUrl, Rol rol, boolean aceptaHabeasData,
            PasswordEncoderPort encoder) {
        if (!aceptaHabeasData) {
            throw new HabeasDataRequeridoException();
        }
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
        usuario.fechaRegistro = LocalDateTime.now(ZoneId.systemDefault());
        usuario.habeasDataAceptado = true;
        usuario.activo = true;
        usuario.tokenVersion = 0;
        return usuario;
    }

    /** Reconstitution from persistence. */
    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo. Ver UsuarioJpaEntity.toDomain para el mapeo 1:1.
    public static Usuario reconstituir(Long id, String nombre, String correo, String passwordHash,
            String telefono, String fotoUrl, Rol rol, LocalDateTime fechaRegistro,
            boolean habeasDataAceptado, boolean activo, int tokenVersion) {
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
        usuario.tokenVersion = tokenVersion;
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

    /** Replaces the stored hash. Token revocation is handled by {@link #incrementarTokenVersion()}. */
    public void cambiarPassword(String nuevaPasswordPlano, PasswordEncoderPort encoder) {
        this.passwordHash = encoder.encode(nuevaPasswordPlano);
    }

    /**
     * Monotonic bump that revokes every previously issued token for this user
     * (design D11). Returns the new version so callers and tests can observe it.
     */
    public int incrementarTokenVersion() {
        return ++this.tokenVersion;
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
    public int getTokenVersion() { return tokenVersion; }

    public void desactivar() { this.activo = false; }
}
