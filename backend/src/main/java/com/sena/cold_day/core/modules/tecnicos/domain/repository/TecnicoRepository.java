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

    /**
     * Lectura por lote de perfiles activos. La usan las vistas que enriquecen una
     * lista (el radar) para no hacer dos queries por elemento.
     */
    List<Tecnico> buscarPorIds(java.util.Collection<TecnicoId> ids);

    Optional<Tecnico> findByUsuarioIdAndActivoTrue(Long usuarioId);

    /**
     * Any technician row of the usuario, active or not. Duplicate detection for
     * second-profile acquisition must see a soft-deleted profile too, so a
     * deactivated technician cannot acquire a second one.
     */
    Optional<Tecnico> findByUsuarioId(Long usuarioId);

    /**
     * Puerta atomica del tecnico: pasa a {@code OCUPADO} solo si sigue
     * {@code DISPONIBLE} y {@code APROBADO}. Devuelve 1 para el ganador y 0 para
     * cualquier accept concurrente, que debe revertir su transaccion.
     *
     * <p>Sin esto, la asignacion estaba protegida por OT (UPDATE condicional sobre
     * {@code ot}) pero no por tecnico: dos OTs distintas aceptadas en paralelo por
     * el mismo tecnico dejaban al tecnico en las dos.
     */
    int ocuparSiDisponible(TecnicoId id);

    void deleteAll();
}
