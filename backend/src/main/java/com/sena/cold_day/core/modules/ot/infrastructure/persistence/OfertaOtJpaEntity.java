package com.sena.cold_day.core.modules.ot.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;

import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

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

/**
 * JPA mapping of {@code oferta_ot} (design D4). {@code ot_id}/{@code tecnico_id}
 * are plain scalar UUID columns (no {@code @ManyToOne}), keeping the domain free
 * of JPA types.
 */
@Entity
@Table(name = "oferta_ot", indexes = {
        @Index(name = "idx_oferta_ot_ot_id", columnList = "ot_id"),
        @Index(name = "idx_oferta_ot_tecnico_id", columnList = "tecnico_id")
})
@Getter
@Setter
@NoArgsConstructor
public class OfertaOtJpaEntity {

    @Id
    private UUID id;

    @Column(name = "ot_id", nullable = false)
    private UUID otId;

    @Column(name = "tecnico_id", nullable = false)
    private UUID tecnicoId;

    @Column(name = "radio_km")
    private double radioKm;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 20, nullable = false)
    private OfertaEstado estado;

    @Column(name = "creada_en")
    private Instant creadaEn;

    @Column(name = "expira_en")
    private Instant expiraEn;

    @Column(name = "resuelta_en")
    private Instant resueltaEn;

    public static OfertaOtJpaEntity fromDomain(OfertaOt source) {
        OfertaOtJpaEntity target = new OfertaOtJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.applyFromDomain(source);
        return target;
    }

    /** Applies domain state into an existing managed row (merge semantics). */
    public void applyFromDomain(OfertaOt source) {
        this.otId = source.getOtId() == null ? null : source.getOtId().valor();
        this.tecnicoId = source.getTecnicoId() == null ? null : source.getTecnicoId().valor();
        this.radioKm = source.getRadioKm();
        this.estado = source.getEstado();
        this.creadaEn = source.getCreadaEn();
        this.expiraEn = source.getExpiraEn();
        this.resueltaEn = source.getResueltaEn();
    }

    public OfertaOt toDomain() {
        return OfertaOt.reconstituir(OfertaOtId.desde(id),
                otId == null ? null : OtId.desde(otId),
                tecnicoId == null ? null : TecnicoId.desde(tecnicoId),
                radioKm, estado, creadaEn, expiraEn, resueltaEn);
    }
}
