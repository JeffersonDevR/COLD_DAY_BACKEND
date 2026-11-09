package com.sena.cold_day.core.modules.ot.domain.valueobjects;

import java.time.Instant;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

/**
 * Proyeccion de lectura de una OT para el tablero administrativo.
 *
 * <p>Existe para que el tablero no hidrate agregados completos: las metricas solo
 * necesitan estado, categoria y tres marcas de tiempo. Cargar la tabla entera como
 * entidades JPA (con sus columnas JSON y el mapeo a dominio) es lo que hacia que el
 * tablero costara memoria proporcional al historico de la plataforma.
 */
public record OtMetrica(
        EstadoOt estado,
        CategoriaServicio categoria,
        Instant creadaEn,
        Instant asignadaEn,
        Instant finalizadaEn) {
}
