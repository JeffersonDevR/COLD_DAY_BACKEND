package com.sena.cold_day.core.modules.tecnicos.domain.repository;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import java.util.List;
import java.util.Optional;

public interface TecnicoRepository {

    Tecnico save(Tecnico tecnico);

    List<Tecnico> findByActivoTrue();

    Optional<Tecnico> findByIdAndActivoTrue(Long id);

    void deleteAll();
}
