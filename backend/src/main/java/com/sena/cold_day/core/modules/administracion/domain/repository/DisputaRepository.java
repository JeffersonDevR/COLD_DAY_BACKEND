package com.sena.cold_day.core.modules.administracion.domain.repository;

import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.administracion.domain.entities.Disputa;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/** Puerto de persistencia de la mediacion administrativa (RF-F1-25). */
public interface DisputaRepository {

    Disputa save(Disputa disputa);

    Optional<Disputa> buscarPorId(DisputaId id);

    Optional<Disputa> buscarAbiertaPorOt(OtId otId);

    List<Disputa> buscarPorEstado(EstadoDisputa estado);

    List<Disputa> listarTodas();
}
