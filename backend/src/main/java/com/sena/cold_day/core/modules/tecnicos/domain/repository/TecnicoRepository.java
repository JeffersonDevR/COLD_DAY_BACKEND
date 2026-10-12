package com.sena.cold_day.core.modules.tecnicos.domain.repository;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import java.util.List;
import java.util.Optional;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.transaction.annotation.Transactional;

public interface TecnicoRepository {

    Tecnico save(Tecnico tecnico);

    List<Tecnico> findByActivoTrue();

    @Transactional(readOnly = true)
    Optional<Tecnico> findByIdAndActivoTrue(TecnicoId id);

    Optional<Tecnico> findByUsuarioIdAndActivoTrue(Long usuarioId);

    /**
     * Any technician row of the usuario, active or not. Duplicate detection for
     * second-profile acquisition must see a soft-deleted profile too, so a
     * deactivated technician cannot acquire a second one.
     */
    Optional<Tecnico> findByUsuarioId(Long usuarioId);

    void deleteAll();
}
