package com.sena.cold_day.core.modules.administracion.infrastructure.api.responses;

import java.util.Map;

import com.sena.cold_day.core.modules.administracion.application.dto.MetricasAdminResponse;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/** Vista API del tablero administrativo (CU-15 / RF-F1-22). */
public record MetricasAdminApiResponse(
        long otsEnEjecucion,
        Map<EstadoOt, Long> otsPorEstado,
        long tecnicosVerificados,
        long tecnicosTotales,
        long tecnicosBloqueadosPorLiquidacion,
        Double tiempoPromedioAsignacionSegundos,
        long disputasAbiertas,
        long liquidacionesPendientesVerificacion) {

    public static MetricasAdminApiResponse from(MetricasAdminResponse response) {
        return new MetricasAdminApiResponse(response.otsEnEjecucion(), response.otsPorEstado(),
                response.tecnicosVerificados(), response.tecnicosTotales(),
                response.tecnicosBloqueadosPorLiquidacion(),
                response.tiempoPromedioAsignacionSegundos(), response.disputasAbiertas(),
                response.liquidacionesPendientesVerificacion());
    }
}
