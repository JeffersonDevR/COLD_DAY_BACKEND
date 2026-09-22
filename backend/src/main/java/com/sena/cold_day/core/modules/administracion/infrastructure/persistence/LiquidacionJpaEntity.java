package com.sena.cold_day.core.modules.administracion.infrastructure.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
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
 * Mapeo JPA del agregado {@code liquidacion}. Los identificadores de OT y
 * tecnico son columnas UUID escalares, sin {@code @ManyToOne}, para mantener
 * el dominio libre de tipos JPA.
 */
@Entity
@Table(name = "liquidacion", indexes = {
        @Index(name = "idx_liquidacion_tecnico_id", columnList = "tecnico_id"),
        @Index(name = "idx_liquidacion_estado", columnList = "estado")
})
@Getter
@Setter
@NoArgsConstructor
public class LiquidacionJpaEntity {

    @Id
    private UUID id;

    @Column(name = "ot_id", nullable = false, unique = true)
    private UUID otId;

    @Column(name = "tecnico_id", nullable = false)
    private UUID tecnicoId;

    @Column(name = "monto_cobrado", precision = 12, scale = 2, nullable = false)
    private BigDecimal montoCobrado;

    @Enumerated(EnumType.STRING)
    @Column(name = "medio_pago", length = 20, nullable = false)
    private MedioPago medioPago;

    @Column(name = "porcentaje_comision", precision = 5, scale = 4, nullable = false)
    private BigDecimal porcentajeComision;

    @Column(name = "valor_comision", precision = 12, scale = 2, nullable = false)
    private BigDecimal valorComision;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 30, nullable = false)
    private EstadoLiquidacion estado;

    @Column(name = "comprobante_url", length = 1000)
    private String comprobanteUrl;

    @Column(name = "motivo_rechazo", length = 500)
    private String motivoRechazo;

    @Column(name = "creada_en")
    private Instant creadaEn;

    @Column(name = "verificada_en")
    private Instant verificadaEn;

    public static LiquidacionJpaEntity fromDomain(Liquidacion source) {
        LiquidacionJpaEntity target = new LiquidacionJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.applyFromDomain(source);
        return target;
    }

    /** Aplica el estado del dominio sobre una fila gestionada (semantica merge). */
    public void applyFromDomain(Liquidacion source) {
        this.otId = source.getOtId() == null ? null : source.getOtId().valor();
        this.tecnicoId = source.getTecnicoId() == null ? null : source.getTecnicoId().valor();
        this.montoCobrado = source.getMontoCobrado();
        this.medioPago = source.getMedioPago();
        this.porcentajeComision = source.getPorcentajeComision();
        this.valorComision = source.getValorComision();
        this.estado = source.getEstado();
        this.comprobanteUrl = source.getComprobanteUrl();
        this.motivoRechazo = source.getMotivoRechazo();
        this.creadaEn = source.getCreadaEn();
        this.verificadaEn = source.getVerificadaEn();
    }

    public Liquidacion toDomain() {
        return Liquidacion.reconstituir(LiquidacionId.desde(id),
                otId == null ? null : OtId.desde(otId),
                tecnicoId == null ? null : TecnicoId.desde(tecnicoId),
                montoCobrado, medioPago, porcentajeComision, valorComision, estado,
                comprobanteUrl, motivoRechazo, creadaEn, verificadaEn);
    }
}
