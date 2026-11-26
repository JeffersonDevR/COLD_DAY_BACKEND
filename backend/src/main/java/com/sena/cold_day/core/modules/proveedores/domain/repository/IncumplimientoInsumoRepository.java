package com.sena.cold_day.core.modules.proveedores.domain.repository;

import java.util.List;

import com.sena.cold_day.core.modules.proveedores.domain.entities.IncumplimientoInsumo;

/** Domain port for the ETA breach record. */
public interface IncumplimientoInsumoRepository {

    void guardar(IncumplimientoInsumo incumplimiento);

    /** At most the 200 most recent, newest replacement first. */
    List<IncumplimientoInsumo> recientes();
}
