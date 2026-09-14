package com.sena.cold_day.core.modules.administracion.application.dto;

import java.util.Map;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;

/**
 * Tablero administrativo (CU-15 / RF-F1-22): servicios en ejecucion, tecnicos
 * verificados, tiempos promedio de atencion e incidencias activas.
 */
public record MetricasAdminResponse(
        long otsEnEjecucion,
        Map<EstadoOt, Long> otsPorEstado,
        long tecnicosVerificados,
        long tecnicosTotales,
        long tecnicosBloqueadosPorLiquidacion,
        Double tiempoPromedioAsignacionSegundos,
        long disputasAbiertas,
        long liquidacionesPendientesVerificacion) {
}
