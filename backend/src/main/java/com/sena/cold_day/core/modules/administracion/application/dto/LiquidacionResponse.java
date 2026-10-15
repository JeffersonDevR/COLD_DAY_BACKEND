package com.sena.cold_day.core.modules.administracion.application.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/** Vista de aplicacion de una liquidacion de recaudo en efectivo (RF-F1-23/24/26). */
public record LiquidacionResponse(
        LiquidacionId id,
        OtId otId,
        String otCodigo,
        TecnicoId tecnicoId,
        BigDecimal montoCobrado,
        MedioPago medioPago,
        BigDecimal porcentajeComision,
        BigDecimal valorComision,
        EstadoLiquidacion estado,
        String comprobanteUrl,
        String motivoRechazo,
        Instant creadaEn,
        Instant verificadaEn,
        String tecnicoNombre) {

    public static LiquidacionResponse fromDomain(Liquidacion liquidacion) {
        return new LiquidacionResponse(liquidacion.getId(), liquidacion.getOtId(), null,
                liquidacion.getTecnicoId(), liquidacion.getMontoCobrado(), liquidacion.getMedioPago(),
                liquidacion.getPorcentajeComision(), liquidacion.getValorComision(), liquidacion.getEstado(),
                liquidacion.getComprobanteUrl(), liquidacion.getMotivoRechazo(), liquidacion.getCreadaEn(),
                liquidacion.getVerificadaEn(), null);
    }

    public LiquidacionResponse conTecnicoNombre(String nombre) {
        return new LiquidacionResponse(id, otId, otCodigo, tecnicoId, montoCobrado, medioPago,
                porcentajeComision, valorComision, estado, comprobanteUrl, motivoRechazo, creadaEn,
                verificadaEn, nombre);
    }

    /**
     * Attaches the human-readable code of the liquidated order, so the UI can
     * name the OT instead of printing its UUID. Null when the caller could not
     * load the order; the code is a display aid, never a key.
     */
    public LiquidacionResponse conOtCodigo(CodigoOt codigo) {
        return new LiquidacionResponse(id, otId, codigo == null ? null : codigo.valor(), tecnicoId,
                montoCobrado, medioPago, porcentajeComision, valorComision, estado, comprobanteUrl,
                motivoRechazo, creadaEn, verificadaEn, tecnicoNombre);
    }
}
