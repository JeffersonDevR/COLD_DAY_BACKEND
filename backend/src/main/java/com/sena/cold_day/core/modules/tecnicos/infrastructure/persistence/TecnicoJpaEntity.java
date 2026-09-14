package com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Own-UUID identity (design D12): {@code tecnico.id} is its own UUID primary
 * key and {@code usuario_id} is a plain scalar foreign key. The previous
 * shared primary key ({@code @MapsId}/{@code @OneToOne}) is intentionally gone.
 */
@Entity
@Table(name = "tecnico")
@Getter
@Setter
@NoArgsConstructor
public class TecnicoJpaEntity {

    @Id
    private UUID id;

    @Column(name = "usuario_id", nullable = false, unique = true)
    private Long usuarioId;

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

    @Column(name = "latitud")
    private Double latitud;

    @Column(name = "longitud")
    private Double longitud;

    @Column(name = "tracking_activo", nullable = false)
    private boolean trackingActivo = false;

    @Column(name = "ubicacion_actualizada_en")
    private Instant ubicacionActualizadaEn;

    public static TecnicoJpaEntity fromDomain(Tecnico source) {
        TecnicoJpaEntity target = new TecnicoJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.apply(source);
        return target;
    }

    /** Applies domain state into an existing managed row (merge semantics). */
    public void applyFromDomain(Tecnico source) {
        apply(source);
    }

    private void apply(Tecnico source) {
        this.usuarioId = source.getUsuarioId();
        this.numeroIdentificacion = source.getNumeroIdentificacion();
        this.categoriasServicio = new HashSet<>(source.getCategoriasServicio());
        this.estadoOperativo = source.getEstadoOperativo();
        this.estadoValidacion = source.getEstadoValidacion();
        this.motivoRechazoValidacion = source.getMotivoRechazoValidacion();
        this.certificaciones = new HashSet<>(source.getCertificaciones());
        this.activo = source.isActivo();
        Point ubicacion = source.getUbicacion();
        this.latitud = ubicacion == null ? null : ubicacion.latitud();
        this.longitud = ubicacion == null ? null : ubicacion.longitud();
        this.trackingActivo = source.isTrackingActivo();
        this.ubicacionActualizadaEn = source.getUbicacionActualizadaEn();
    }

    public Tecnico toDomain() {
        Point ubicacion = latitud == null || longitud == null ? null : new Point(latitud, longitud);
        return Tecnico.reconstituir(TecnicoId.desde(id), usuarioId, numeroIdentificacion,
                categoriasServicio == null ? new HashSet<>() : new HashSet<>(categoriasServicio),
                estadoOperativo,
                estadoValidacion == null ? EstadoValidacion.PENDIENTE : estadoValidacion,
                motivoRechazoValidacion,
                certificaciones == null ? new HashSet<>() : new HashSet<>(certificaciones), activo,
                ubicacion, trackingActivo, ubicacionActualizadaEn);
    }
}
