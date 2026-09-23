package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.RequerimientoInsumoItem;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * JPA mapping of {@code requerimiento_insumo} (design schema, AD5). {@code ot_id}
 * and {@code tecnico_id} are plain scalar UUID columns (no {@code @ManyToOne}),
 * keeping the domain free of {@code ot}/{@code tecnicos} types. The immutable
 * lines are an owned child collection cascaded from this root; {@code version}
 * drives optimistic locking exactly as {@code OtJpaEntity} does.
 */
@Entity
@Table(name = "requerimiento_insumo", indexes = {
        @Index(name = "idx_req_insumo_ot_id", columnList = "ot_id"),
        @Index(name = "idx_req_insumo_estado", columnList = "estado")
})
@Getter
@Setter
@NoArgsConstructor
public class RequerimientoInsumoJpaEntity {

    @Id
    private UUID id;

    @Column(name = "ot_id", nullable = false)
    private UUID otId;

    @Column(name = "tecnico_id", nullable = false)
    private UUID tecnicoId;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 20, nullable = false)
    private EstadoRequerimiento estado;

    @Column(name = "observaciones", length = 1000)
    private String observaciones;

    @Column(name = "creada_en")
    private Instant creadaEn;

    @Column(name = "expira_en")
    private Instant expiraEn;

    @Column(name = "resuelta_en")
    private Instant resueltaEn;

    // Lines are immutable by domain contract, so they are written only on insert.
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "requerimiento_id", nullable = false)
    @OrderBy("id ASC")
    private List<RequerimientoInsumoItemJpaEntity> items = new ArrayList<>();

    @Version
    @Column(name = "version")
    private Long version;

    public static RequerimientoInsumoJpaEntity fromDomain(RequerimientoInsumo source) {
        RequerimientoInsumoJpaEntity target = new RequerimientoInsumoJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.applyScalars(source);
        target.items = new ArrayList<>();
        for (RequerimientoInsumoItem item : source.getItems()) {
            target.items.add(RequerimientoInsumoItemJpaEntity.fromDomain(item));
        }
        return target;
    }

    /** Applies scalar state into an existing managed row (merge semantics). */
    public void applyFromDomain(RequerimientoInsumo source) {
        applyScalars(source);
    }

    private void applyScalars(RequerimientoInsumo source) {
        this.otId = source.getOtId();
        this.tecnicoId = source.getTecnicoId();
        this.estado = source.getEstado();
        this.observaciones = source.getObservaciones();
        this.creadaEn = source.getCreadaEn();
        this.expiraEn = source.getExpiraEn();
        this.resueltaEn = source.getResueltaEn();
    }

    public RequerimientoInsumo toDomain() {
        List<RequerimientoInsumoItem> domainItems = items == null
                ? new ArrayList<>()
                : items.stream().map(RequerimientoInsumoItemJpaEntity::toDomain).toList();
        return RequerimientoInsumo.reconstituir(RequerimientoInsumoId.desde(id), otId, tecnicoId, estado,
                observaciones, domainItems, creadaEn, expiraEn, resueltaEn);
    }
}
