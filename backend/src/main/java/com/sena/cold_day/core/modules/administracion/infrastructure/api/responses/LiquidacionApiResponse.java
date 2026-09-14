package com.sena.cold_day.core.modules.administracion.infrastructure.api.responses;

import java.math.BigDecimal;
import java.time.Instant;

import com.sena.cold_day.core.modules.administracion.application.dto.LiquidacionResponse;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;

/** Vista API de una liquidacion: identificadores como UUID planos. */
public record LiquidacionApiResponse(
        String id,
        String otId,
        String tecnicoId,
        BigDecimal montoCobrado,
        MedioPago medioPago,
        BigDecimal porcentajeComision,
        BigDecimal valorComision,
        EstadoLiquidacion estado,
        String comprobanteUrl,
        String motivoRechazo,
        Instant creadaEn,
        Instant verificadaEn) {

    public static LiquidacionApiResponse from(LiquidacionResponse response) {
        return new LiquidacionApiResponse(
                response.id() == null ? null : response.id().valor().toString(),
                response.otId() == null ? null : response.otId().valor().toString(),
                response.tecnicoId() == null ? null : response.tecnicoId().valor().toString(),
                response.montoCobrado(), response.medioPago(), response.porcentajeComision(),
                response.valorComision(), response.estado(), response.comprobanteUrl(),
                response.motivoRechazo(), response.creadaEn(), response.verificadaEn());
    }
}
