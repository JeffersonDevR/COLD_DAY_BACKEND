package com.sena.cold_day.core.modules.administracion.domain.repository;

import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/** Puerto de persistencia del agregado {@code Liquidacion} (RF-F1-23/24). */
public interface LiquidacionRepository {

    Liquidacion save(Liquidacion liquidacion);

    Optional<Liquidacion> buscarPorId(LiquidacionId id);

    Optional<Liquidacion> buscarPorOt(OtId otId);

    List<Liquidacion> buscarPorTecnico(TecnicoId tecnicoId);

    List<Liquidacion> buscarPorEstado(EstadoLiquidacion estado);

    /** ¿Tiene el tecnico alguna liquidacion que lo mantenga bloqueado? */
    boolean existeBloqueadoraPara(TecnicoId tecnicoId);

    List<Liquidacion> listarTodas();
}
