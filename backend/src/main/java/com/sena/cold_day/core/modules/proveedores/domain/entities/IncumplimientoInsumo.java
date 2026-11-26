package com.sena.cold_day.core.modules.proveedores.domain.entities;

import java.time.Instant;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * A committed ETA that elapsed and made the technician move the request to another
 * supplier. It is a record only: it carries no sanction.
 */
public record IncumplimientoInsumo(UUID id, RequerimientoInsumoId requerimientoId, ProveedorId proveedorId,
        int etaMinutos, Instant aceptadaEn, Instant reemplazadoEn) {
}
