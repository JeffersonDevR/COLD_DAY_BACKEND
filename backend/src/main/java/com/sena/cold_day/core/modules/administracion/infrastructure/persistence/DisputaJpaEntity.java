package com.sena.cold_day.core.modules.administracion.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;

import com.sena.cold_day.core.modules.administracion.domain.entities.Disputa;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Mapeo JPA de la mediacion administrativa {@code disputa} (RF-F1-25). */
@Entity
@Table(name = "disputa", indexes = {
        @Index(name = "idx_disputa_ot_id", columnList = "ot_id"),
        @Index(name = "idx_disputa_estado", columnList = "estado")
})
@Getter
@Setter
@NoArgsConstructor
public class DisputaJpaEntity {

    @Id
    private UUID id;

    @Column(name = "ot_id", nullable = false)
    private UUID otId;

    @Column(name = "motivo", length = 1000, nullable = false)
    private String motivo;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 30, nullable = false)
    private EstadoDisputa estado;

    @Column(name = "resolucion", length = 1000)
    private String resolucion;

    @Column(name = "creada_en")
    private Instant creadaEn;

    @Column(name = "resuelta_en")
    private Instant resueltaEn;

    public static DisputaJpaEntity fromDomain(Disputa source) {
        DisputaJpaEntity target = new DisputaJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.applyFromDomain(source);
        return target;
    }

    /** Aplica el estado del dominio sobre una fila gestionada (semantica merge). */
    public void applyFromDomain(Disputa source) {
        this.otId = source.getOtId() == null ? null : source.getOtId().valor();
        this.motivo = source.getMotivo();
        this.estado = source.getEstado();
        this.resolucion = source.getResolucion();
        this.creadaEn = source.getCreadaEn();
        this.resueltaEn = source.getResueltaEn();
    }

    public Disputa toDomain() {
        return Disputa.reconstituir(DisputaId.desde(id),
                otId == null ? null : OtId.desde(otId),
                motivo, estado, resolucion, creadaEn, resueltaEn);
    }
}
