package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import java.time.Instant;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.DispositivoPush;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "dispositivo_push")
@Getter
@Setter
@NoArgsConstructor
public class DispositivoPushJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(nullable = false, length = 512)
    private String token;

    @Column(nullable = false, length = 10)
    private String plataforma;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    @Column(name = "actualizado_en", nullable = false)
    private Instant actualizadoEn;

    public static DispositivoPushJpaEntity fromDomain(DispositivoPush d) {
        DispositivoPushJpaEntity e = new DispositivoPushJpaEntity();
        e.id = d.id();
        e.usuarioId = d.usuarioId();
        e.token = d.token();
        e.plataforma = d.plataforma();
        e.creadoEn = d.creadoEn();
        e.actualizadoEn = d.actualizadoEn();
        return e;
    }

    public DispositivoPush toDomain() {
        return new DispositivoPush(id, usuarioId, token, plataforma, creadoEn, actualizadoEn);
    }
}
