package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * JPA mapping of the {@code ot} aggregate. {@code cliente_id}/{@code tecnico_id}
 * are plain scalar UUID columns (no {@code @ManyToOne}), keeping the domain free
 * of JPA types; {@code version} drives optimistic locking (design D8).
 */
@Entity
@Table(name = "ot")
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
    @Column(name = "evidencia_urls", length = 4000)
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
    }

    public Ot toDomain() {
        Point ubicacion = latitud == null || longitud == null ? null : new Point(latitud, longitud);
        return Ot.reconstituir(OtId.desde(id),
                clienteId == null ? null : new ClienteId(clienteId),
                tecnicoId == null ? null : TecnicoId.desde(tecnicoId),
                categoriaServicio, descripcionFalla,
                evidenciaUrls == null ? new ArrayList<>() : new ArrayList<>(evidenciaUrls),
                direccion, ubicacion, estado, radioKm, ventanaExpiraEn, creadaEn, asignadaEn, finalizadaEn,
                canceladaPor, motivoCancelacion, tarifaVisita);
    }
}
