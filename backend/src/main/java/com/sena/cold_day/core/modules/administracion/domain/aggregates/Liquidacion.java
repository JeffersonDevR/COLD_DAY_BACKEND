package com.sena.cold_day.core.modules.administracion.domain.aggregates;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Liquidacion de un cierre en efectivo/transferencia (RF-F1-23/24/26, CU-12/13).
 *
 * <p>El tecnico registra monto y medio al cierre de la OT; el sistema calcula la
 * comision de intermediacion y el tecnico queda bloqueado hasta que el
 * administrador apruebe el comprobante de consignacion.
 */
public class Liquidacion {

    private LiquidacionId id;
    private OtId otId;
    private TecnicoId tecnicoId;
    private BigDecimal montoCobrado;
    private MedioPago medioPago;
    private BigDecimal porcentajeComision;
    private BigDecimal valorComision;
    private EstadoLiquidacion estado;
    private String comprobanteUrl;
    private String motivoRechazo;
    private Instant creadaEn;
    private Instant verificadaEn;

    private Liquidacion() {
    }

    /**
     * Registra el cobro manual del tecnico (RF-F1-26) y calcula la comision
     * (RF-F1-23). Nace en {@code PENDIENTE_CONSIGNACION}.
     */
    public static Liquidacion registrar(OtId otId, TecnicoId tecnicoId, BigDecimal montoCobrado,
            MedioPago medioPago, BigDecimal porcentajeComision, Instant ahora) {
        if (otId == null) {
            throw new IllegalArgumentException("La orden de trabajo es requerida");
        }
        if (tecnicoId == null) {
            throw new IllegalArgumentException("El tecnico es requerido");
        }
        if (montoCobrado == null || montoCobrado.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto cobrado debe ser positivo");
        }
        if (medioPago == null) {
            throw new IllegalArgumentException("El medio de pago es requerido");
        }
        if (porcentajeComision == null || porcentajeComision.compareTo(BigDecimal.ZERO) < 0
                || porcentajeComision.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("El porcentaje de comision debe estar entre 0 y 1");
        }
        if (ahora == null) {
            throw new IllegalArgumentException("El momento de registro es requerido");
        }
        Liquidacion liquidacion = new Liquidacion();
        liquidacion.id = LiquidacionId.nueva();
        liquidacion.otId = otId;
        liquidacion.tecnicoId = tecnicoId;
        liquidacion.montoCobrado = montoCobrado;
        liquidacion.medioPago = medioPago;
        liquidacion.porcentajeComision = porcentajeComision;
        liquidacion.valorComision = montoCobrado.multiply(porcentajeComision)
                .setScale(2, RoundingMode.HALF_UP);
        liquidacion.estado = EstadoLiquidacion.PENDIENTE_CONSIGNACION;
        liquidacion.creadaEn = ahora;
        return liquidacion;
    }

    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo del agregado.
    public static Liquidacion reconstituir(LiquidacionId id, OtId otId, TecnicoId tecnicoId,
            BigDecimal montoCobrado, MedioPago medioPago, BigDecimal porcentajeComision,
            BigDecimal valorComision, EstadoLiquidacion estado, String comprobanteUrl,
            String motivoRechazo, Instant creadaEn, Instant verificadaEn) {
        Liquidacion liquidacion = new Liquidacion();
        liquidacion.id = id;
        liquidacion.otId = otId;
        liquidacion.tecnicoId = tecnicoId;
        liquidacion.montoCobrado = montoCobrado;
        liquidacion.medioPago = medioPago;
        liquidacion.porcentajeComision = porcentajeComision;
        liquidacion.valorComision = valorComision;
        liquidacion.estado = estado;
        liquidacion.comprobanteUrl = comprobanteUrl;
        liquidacion.motivoRechazo = motivoRechazo;
        liquidacion.creadaEn = creadaEn;
        liquidacion.verificadaEn = verificadaEn;
        return liquidacion;
    }

    /**
     * El tecnico carga la foto del comprobante (RF-F1-24) y la liquidacion pasa
     * a verificacion del administrador. Puede recargarse tras un rechazo.
     */
    public void cargarComprobante(String comprobanteUrl) {
        if (comprobanteUrl == null || comprobanteUrl.isBlank()) {
            throw new IllegalArgumentException("La URL del comprobante es requerida");
        }
        if (estado != EstadoLiquidacion.PENDIENTE_CONSIGNACION
                && estado != EstadoLiquidacion.RECHAZADA) {
            throw new IllegalStateException(
                    "Solo se puede cargar el comprobante en PENDIENTE_CONSIGNACION o RECHAZADA, estado actual: "
                            + estado);
        }
        this.comprobanteUrl = comprobanteUrl;
        this.motivoRechazo = null;
        this.estado = EstadoLiquidacion.EN_VERIFICACION;
    }

    /** El administrador aprueba el soporte y libera al tecnico (CU-13). */
    public void aprobar(Instant ahora) {
        if (estado != EstadoLiquidacion.EN_VERIFICACION) {
            throw new IllegalStateException(
                    "Solo se puede aprobar en EN_VERIFICACION, estado actual: " + estado);
        }
        this.estado = EstadoLiquidacion.APROBADA;
        this.motivoRechazo = null;
        this.verificadaEn = ahora;
    }

    /** El administrador rechaza el soporte; el tecnico sigue bloqueado (CU-13, 2a). */
    public void rechazar(String motivo, Instant ahora) {
        if (estado != EstadoLiquidacion.EN_VERIFICACION) {
            throw new IllegalStateException(
                    "Solo se puede rechazar en EN_VERIFICACION, estado actual: " + estado);
        }
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("El motivo del rechazo es requerido");
        }
        this.estado = EstadoLiquidacion.RECHAZADA;
        this.motivoRechazo = motivo;
        this.verificadaEn = ahora;
    }

    public LiquidacionId getId() {
        return id;
    }

    public OtId getOtId() {
        return otId;
    }

    public TecnicoId getTecnicoId() {
        return tecnicoId;
    }

    public BigDecimal getMontoCobrado() {
        return montoCobrado;
    }

    public MedioPago getMedioPago() {
        return medioPago;
    }

    public BigDecimal getPorcentajeComision() {
        return porcentajeComision;
    }

    public BigDecimal getValorComision() {
        return valorComision;
    }

    public EstadoLiquidacion getEstado() {
        return estado;
    }

    public String getComprobanteUrl() {
        return comprobanteUrl;
    }

    public String getMotivoRechazo() {
        return motivoRechazo;
    }

    public Instant getCreadaEn() {
        return creadaEn;
    }

    public Instant getVerificadaEn() {
        return verificadaEn;
    }
}
