package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * JPA mapping of the {@code ot} aggregate. {@code cliente_id}/{@code tecnico_id}
 * are plain scalar UUID columns (no {@code @ManyToOne}), keeping the domain free
 * of JPA types; {@code version} drives optimistic locking (design D8).
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "ot", indexes = {
        @Index(name = "idx_ot_cliente_id", columnList = "cliente_id"),
        @Index(name = "idx_ot_tecnico_id", columnList = "tecnico_id"),
        @Index(name = "idx_ot_estado", columnList = "estado")
})
@Getter
@Setter
@NoArgsConstructor
public class OtJpaEntity {

    @Id
    private UUID id;

    @Column(name = "cliente_id", nullable = false)
    private UUID clienteId;

    @Column(name = "tecnico_id")
    private UUID tecnicoId;

    @Enumerated(EnumType.STRING)
    @Column(name = "categoria_servicio", length = 30)
    private CategoriaServicio categoriaServicio;

    @Column(name = "descripcion_falla", length = 1000)
    private String descripcionFalla;

    @Convert(converter = EvidenciaUrlsJsonConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidencia_urls")
    private List<String> evidenciaUrls = new ArrayList<>();

    @Column(name = "direccion", length = 500)
    private String direccion;

    @Column(name = "latitud")
    private Double latitud;

    @Column(name = "longitud")
    private Double longitud;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 30, nullable = false)
    private EstadoOt estado;

    @Column(name = "radio_km")
    private double radioKm;

    @Column(name = "ventana_expira_en")
    private Instant ventanaExpiraEn;

    @Column(name = "creada_en")
    private Instant creadaEn;

    // Audit metadata (V10): persistence-layer only, never assigned by
    // applyFromDomain and never mapped into the domain or an *ApiResponse.
    // creadaEn above is a BUSINESS timestamp fed by Ot.crear from the Clock
    // bean — it is deliberately NOT @CreatedDate, because Spring's
    // DateTimeProvider would overwrite the deterministic Clock value that
    // CrearOtUseCase / CalificarOtUseCase / AceptarOfertaUseCase and their
    // fixed-clock tests depend on. The four-field block is duplicated across the
    // four audited entities on purpose — a shared @MappedSuperclass would push a
    // JPA type into core/shared across the vertical module boundary.
    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false, length = 255)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "last_modified_by", length = 255)
    private String lastModifiedBy;

    @Column(name = "asignada_en")
    private Instant asignadaEn;

    @Column(name = "finalizada_en")
    private Instant finalizadaEn;

    @Enumerated(EnumType.STRING)
    @Column(name = "cancelada_por", length = 20)
    private ActorOt canceladaPor;

    @Enumerated(EnumType.STRING)
    @Column(name = "motivo_cancelacion", length = 30)
    private MotivoCancelacion motivoCancelacion;

    @Column(name = "tarifa_visita", precision = 12, scale = 2)
    private BigDecimal tarifaVisita;

    @Convert(converter = DiagnosticoJsonConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "diagnostico")
    private Diagnostico diagnostico;

    @Convert(converter = PresupuestoJsonConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "presupuesto")
    private Presupuesto presupuesto;

    // Authoritative tariff detail (design AD13): nullable so existing rows
    // survive the additive ALTER and stay NULL until the tariff is persisted.
    @Column(name = "distancia_km")
    private Double distanciaKm;

    @Column(name = "tarifa_fuente", length = 20)
    private String tarifaFuente;

    // Auxiliar count declared at acceptance (design AD2). Non-null with a server
    // default so the additive ALTER fills pre-existing rows with 0.
    @Column(name = "auxiliares_requeridos", nullable = false, columnDefinition = "integer default 0")
    private int auxiliaresRequeridos;

    // Visit tracking and rating (V7): all nullable so rows created before the
    // migration survive the additive ALTER and read back as NULL until the
    // corresponding aggregate behaviour is invoked.
    @Column(name = "llegada_en")
    private Instant llegadaEn;

    @Column(name = "medio_pago_visita", length = 30)
    private String medioPagoVisita;

    @Column(name = "visita_pagada_en")
    private Instant visitaPagadaEn;

    @Column(name = "calificacion_estrellas")
    private Integer calificacionEstrellas;

    @Column(name = "calificacion_comentario", length = 1000)
    private String calificacionComentario;

    @Column(name = "calificacion_en")
    private Instant calificacionEn;

    /** Plain scalar UUID, same convention as {@code cliente_id}/{@code tecnico_id}. */
    @Column(name = "calificacion_tecnico_id")
    private UUID calificacionTecnicoId;

    @Version
    @Column(name = "version")
    private Long version;

    public static OtJpaEntity fromDomain(Ot source) {
        OtJpaEntity target = new OtJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.applyFromDomain(source);
        return target;
    }

    /** Applies domain state into an existing managed row (merge semantics). */
    public void applyFromDomain(Ot source) {
        this.clienteId = source.getClienteId() == null ? null : source.getClienteId().valor();
        this.tecnicoId = source.getTecnicoId() == null ? null : source.getTecnicoId().valor();
        this.categoriaServicio = source.getCategoriaServicio();
        this.descripcionFalla = source.getDescripcionFalla();
        this.evidenciaUrls = new ArrayList<>(source.getEvidenciaUrls());
        this.direccion = source.getDireccion();
        Point ubicacion = source.getUbicacion();
        this.latitud = ubicacion == null ? null : ubicacion.latitud();
        this.longitud = ubicacion == null ? null : ubicacion.longitud();
        this.estado = source.getEstado();
        this.radioKm = source.getRadioKm();
        this.ventanaExpiraEn = source.getVentanaExpiraEn();
        this.creadaEn = source.getCreadaEn();
        this.asignadaEn = source.getAsignadaEn();
        this.finalizadaEn = source.getFinalizadaEn();
        this.canceladaPor = source.getCanceladaPor();
        this.motivoCancelacion = source.getMotivoCancelacion();
        this.tarifaVisita = source.getTarifaVisita();
        this.distanciaKm = source.getDistanciaKm();
        this.tarifaFuente = source.getTarifaFuente() == null ? null : source.getTarifaFuente().name();
        this.auxiliaresRequeridos = source.getAuxiliaresRequeridos();
        this.diagnostico = source.getDiagnostico();
        this.presupuesto = source.getPresupuesto();
        this.llegadaEn = source.getLlegadaEn();
        this.medioPagoVisita = source.getMedioPagoVisita();
        this.visitaPagadaEn = source.getVisitaPagadaEn();
        this.calificacionEstrellas = source.getCalificacionEstrellas();
        this.calificacionComentario = source.getCalificacionComentario();
        this.calificacionEn = source.getCalificacionEn();
        this.calificacionTecnicoId = source.getCalificacionTecnicoId() == null ? null
                : source.getCalificacionTecnicoId().valor();
    }

    public Ot toDomain() {
        Point ubicacion = latitud == null || longitud == null ? null : new Point(latitud, longitud);
        return Ot.reconstituir(OtId.desde(id),
                clienteId == null ? null : new ClienteId(clienteId),
                tecnicoId == null ? null : TecnicoId.desde(tecnicoId),
                categoriaServicio, descripcionFalla,
                evidenciaUrls == null ? new ArrayList<>() : new ArrayList<>(evidenciaUrls),
                direccion, ubicacion, estado, radioKm, ventanaExpiraEn, creadaEn, asignadaEn, finalizadaEn,
                canceladaPor, motivoCancelacion, tarifaVisita, diagnostico, presupuesto, distanciaKm,
                tarifaFuente == null ? null : TarifaFuente.valueOf(tarifaFuente), auxiliaresRequeridos,
                llegadaEn, medioPagoVisita, visitaPagadaEn, calificacionEstrellas, calificacionComentario,
                calificacionEn, calificacionTecnicoId == null ? null : TecnicoId.desde(calificacionTecnicoId));
    }
}
