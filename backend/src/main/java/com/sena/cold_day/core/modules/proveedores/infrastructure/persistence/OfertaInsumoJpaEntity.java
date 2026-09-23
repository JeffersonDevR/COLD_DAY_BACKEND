package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * JPA mapping of {@code oferta_insumo} (design schema, AD6). {@code requerimiento_id}
 * and {@code proveedor_id} are plain scalar UUID columns (no {@code @ManyToOne}).
 * The table deliberately has NO {@code precio_total}: broadcast first-to-accept has
 * no price-entry flow, so the column would be dead schema.
 */
@Entity
@Table(name = "oferta_insumo", indexes = {
        @Index(name = "idx_oferta_insumo_req_id", columnList = "requerimiento_id"),
        @Index(name = "idx_oferta_insumo_proveedor_id", columnList = "proveedor_id")
})
@Getter
@Setter
@NoArgsConstructor
public class OfertaInsumoJpaEntity {

    @Id
    private UUID id;

    @Column(name = "requerimiento_id", nullable = false)
    private UUID requerimientoId;

    @Column(name = "proveedor_id", nullable = false)
    private UUID proveedorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 20, nullable = false)
    private OfertaInsumoEstado estado;

    @Column(name = "creada_en")
    private Instant creadaEn;

    @Column(name = "expira_en")
    private Instant expiraEn;

    @Column(name = "resuelta_en")
    private Instant resueltaEn;

    @Version
    @Column(name = "version")
    private Long version;

    public static OfertaInsumoJpaEntity fromDomain(OfertaInsumo source) {
        OfertaInsumoJpaEntity target = new OfertaInsumoJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.applyFromDomain(source);
        return target;
    }

    /** Applies domain state into an existing managed row (merge semantics). */
    public void applyFromDomain(OfertaInsumo source) {
        this.requerimientoId = source.getRequerimientoId() == null ? null : source.getRequerimientoId().valor();
        this.proveedorId = source.getProveedorId() == null ? null : source.getProveedorId().valor();
        this.estado = source.getEstado();
        this.creadaEn = source.getCreadaEn();
        this.expiraEn = source.getExpiraEn();
        this.resueltaEn = source.getResueltaEn();
    }

    public OfertaInsumo toDomain() {
        return OfertaInsumo.reconstituir(OfertaInsumoId.desde(id),
                requerimientoId == null ? null : RequerimientoInsumoId.desde(requerimientoId),
                proveedorId == null ? null : ProveedorId.desde(proveedorId),
                estado, creadaEn, expiraEn, resueltaEn);
    }
}
