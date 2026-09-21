package com.sena.cold_day.core.modules.administracion.application.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

/**
 * Tablero administrativo (CU-15 / RF-F1-22): servicios en ejecucion, tecnicos
 * verificados, tiempos promedio de atencion, incidencias activas y series para
 * las graficas de analitica (distribucion por especialidad e historico semanal).
 */
public record MetricasAdminResponse(
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
        List<DistribucionCategoria> distribucionCategorias,
        List<HistoricoDia> historicoSemanal) {

    public record DistribucionCategoria(CategoriaServicio categoria, long cantidad, double porcentaje) {
    }

    public record HistoricoDia(String dia, long completadas, long canceladas) {
    }
}
