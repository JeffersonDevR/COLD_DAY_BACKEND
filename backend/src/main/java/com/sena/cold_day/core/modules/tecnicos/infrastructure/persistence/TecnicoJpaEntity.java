package com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Shared primary key with usuario (1-to-1) via @MapsId: tecnico.id equals
 * usuario.id. No identity columns live in this table anymore.
 */
@Entity
@Table(name = "tecnico")
@Getter
@Setter
@NoArgsConstructor
public class TecnicoJpaEntity {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "id")
    private UsuarioJpaEntity usuario;

    @Column(name = "numero_identificacion", nullable = false, unique = true)
    private String numeroIdentificacion;

    @Convert(converter = CategoriaServicioJsonConverter.class)
    @Column(name = "categorias_servicio", length = 4000)
    private Set<CategoriaServicio> categoriasServicio = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_operativo")
    private EstadoOperativo estadoOperativo;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_validacion", nullable = false)
    private EstadoValidacion estadoValidacion = EstadoValidacion.PENDIENTE;

    @Column(name = "motivo_rechazo_validacion", length = 500)
    private String motivoRechazoValidacion;

    @Convert(converter = CertificacionJsonConverter.class)
    @Column(name = "certificaciones", length = 4000)
    private Set<Certificacion> certificaciones = new HashSet<>();

    @Column(nullable = false)
    private boolean activo = true;

    public static TecnicoJpaEntity fromDomain(Tecnico source, UsuarioJpaEntity usuarioRef) {
        TecnicoJpaEntity target = new TecnicoJpaEntity();
        target.usuario = usuarioRef;
        target.apply(source);
        return target;
    }

    /** Applies domain state into an existing managed row (merge semantics). */
    public void applyFromDomain(Tecnico source) {
        apply(source);
    }

    private void apply(Tecnico source) {
        this.numeroIdentificacion = source.getNumeroIdentificacion();
        this.categoriasServicio = new HashSet<>(source.getCategoriasServicio());
        this.estadoOperativo = source.getEstadoOperativo();
        this.estadoValidacion = source.getEstadoValidacion();
        this.motivoRechazoValidacion = source.getMotivoRechazoValidacion();
        this.certificaciones = new HashSet<>(source.getCertificaciones());
        this.activo = source.isActivo();
    }

    public Tecnico toDomain() {
        return Tecnico.reconstituir(TecnicoId.desde(id), usuario.getId(), numeroIdentificacion,
                categoriasServicio == null ? new HashSet<>() : new HashSet<>(categoriasServicio),
                estadoOperativo,
                estadoValidacion == null ? EstadoValidacion.PENDIENTE : estadoValidacion,
                motivoRechazoValidacion,
                certificaciones == null ? new HashSet<>() : new HashSet<>(certificaciones), activo);
    }
}
