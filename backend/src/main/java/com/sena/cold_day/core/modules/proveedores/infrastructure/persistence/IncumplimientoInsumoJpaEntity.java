package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.entities.IncumplimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.NoArgsConstructor;

/** JPA mapping of {@code incumplimiento_insumo} (V22). Rows are written once and never updated. */
@Entity
@Table(name = "incumplimiento_insumo")
@NoArgsConstructor
public class IncumplimientoInsumoJpaEntity {

    @Id
    private UUID id;

    @Column(name = "requerimiento_id", nullable = false)
    private UUID requerimientoId;

    @Column(name = "proveedor_id", nullable = false)
    private UUID proveedorId;

    @Column(name = "eta_minutos", nullable = false)
    private int etaMinutos;

    @Column(name = "aceptada_en", nullable = false)
    private Instant aceptadaEn;

    @Column(name = "reemplazado_en", nullable = false)
    private Instant reemplazadoEn;

    public static IncumplimientoInsumoJpaEntity fromDomain(IncumplimientoInsumo source) {
        IncumplimientoInsumoJpaEntity target = new IncumplimientoInsumoJpaEntity();
        target.id = source.id();
        target.requerimientoId = source.requerimientoId().valor();
        target.proveedorId = source.proveedorId().valor();
        target.etaMinutos = source.etaMinutos();
        target.aceptadaEn = source.aceptadaEn();
        target.reemplazadoEn = source.reemplazadoEn();
        return target;
    }

    public IncumplimientoInsumo toDomain() {
        return new IncumplimientoInsumo(id, RequerimientoInsumoId.desde(requerimientoId),
                ProveedorId.desde(proveedorId), etaMinutos, aceptadaEn, reemplazadoEn);
    }
}
