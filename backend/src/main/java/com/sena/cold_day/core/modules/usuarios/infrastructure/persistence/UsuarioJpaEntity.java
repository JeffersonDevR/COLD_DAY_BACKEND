package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import java.time.LocalDateTime;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
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
@Table(name = "usuario")
@Getter
@Setter
@NoArgsConstructor
public class UsuarioJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    @Column(nullable = false, unique = true)
    private String correo;

    @Column(name = "password_hash", nullable = false, length = 200)
    private String passwordHash;

    @Column(length = 30)
    private String telefono;

    @Column(name = "foto_url")
    private String fotoUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Rol rol;

    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro;

    @Column(name = "habeas_data_aceptado", nullable = false)
    private boolean habeasDataAceptado;

    @Column(nullable = false)
    private boolean activo = true;

    public static UsuarioJpaEntity fromDomain(Usuario usuario) {
        UsuarioJpaEntity target = new UsuarioJpaEntity();
        target.id = usuario.getId();
        target.nombre = usuario.getNombre();
        target.correo = usuario.getCorreo();
        target.passwordHash = usuario.getPasswordHash();
        target.telefono = usuario.getTelefono();
        target.fotoUrl = usuario.getFotoUrl();
        target.rol = usuario.getRol();
        target.fechaRegistro = usuario.getFechaRegistro();
        target.habeasDataAceptado = usuario.isHabeasDataAceptado();
        target.activo = usuario.isActivo();
        return target;
    }

    public Usuario toDomain() {
        return Usuario.reconstituir(id, nombre, correo, passwordHash, telefono, fotoUrl, rol,
                fechaRegistro, habeasDataAceptado, activo);
    }
}
