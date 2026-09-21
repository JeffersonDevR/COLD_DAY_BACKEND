package com.sena.cold_day.core.modules.ot.application.dto;

/**
 * OT enriquecida con los nombres legibles de cliente y técnico para los
 * listados (monitoreo, panel cliente/técnico), evitando que la UI muestre
 * columnas vacías.
 */
public record OtResumenResponse(OtResponse ot, String clienteNombre, String tecnicoNombre) {
}
