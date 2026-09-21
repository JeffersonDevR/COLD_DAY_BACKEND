package com.sena.cold_day.core.modules.administracion.infrastructure.api.responses;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.sena.cold_day.core.modules.administracion.application.dto.MetricasAdminResponse;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

/** Vista API del tablero administrativo (CU-15 / RF-F1-22). */
public record MetricasAdminApiResponse(
        long otsEnEjecucion,
        Map<EstadoOt, Long> otsPorEstado,
        long tecnicosVerificados,
        long tecnicosTotales,
        long tecnicosBloqueadosPorLiquidacion,
        long tecnicosDisponibles,
        Double tiempoPromedioAsignacionSegundos,
        long disputasAbiertas,
        long liquidacionesPendientesVerificacion,
        BigDecimal totalRecaudoMesCop,
        BigDecimal comisionesMesCop,
        List<DistribucionCategoriaApi> distribucionCategorias,
        List<HistoricoDiaApi> historicoSemanal) {

    public record DistribucionCategoriaApi(CategoriaServicio categoria, long cantidad, double porcentaje) {
    }

    public record HistoricoDiaApi(String dia, long completadas, long canceladas) {
    }

    public static MetricasAdminApiResponse from(MetricasAdminResponse response) {
        List<DistribucionCategoriaApi> distribucion = response.distribucionCategorias().stream()
                .map(d -> new DistribucionCategoriaApi(d.categoria(), d.cantidad(), d.porcentaje()))
                .toList();
        List<HistoricoDiaApi> historico = response.historicoSemanal().stream()
                .map(h -> new HistoricoDiaApi(h.dia(), h.completadas(), h.canceladas()))
                .toList();
        return new MetricasAdminApiResponse(response.otsEnEjecucion(), response.otsPorEstado(),
                response.tecnicosVerificados(), response.tecnicosTotales(),
                response.tecnicosBloqueadosPorLiquidacion(), response.tecnicosDisponibles(),
                response.tiempoPromedioAsignacionSegundos(), response.disputasAbiertas(),
                response.liquidacionesPendientesVerificacion(), response.totalRecaudoMesCop(),
                response.comisionesMesCop(), distribucion, historico);
    }
}
