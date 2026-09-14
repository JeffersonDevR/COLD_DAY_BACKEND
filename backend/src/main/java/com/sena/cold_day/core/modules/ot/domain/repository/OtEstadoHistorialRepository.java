package com.sena.cold_day.core.modules.ot.domain.repository;

import java.util.List;

import com.sena.cold_day.core.modules.ot.domain.entities.OtEstadoHistorial;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * Append-only history port (RNF-09, design D3). The absence of update and
 * delete operations is the contract: history is written once and read.
 */
public interface OtEstadoHistorialRepository {

    OtEstadoHistorial append(OtEstadoHistorial entrada);

    List<OtEstadoHistorial> listarPorOt(OtId otId);
}
