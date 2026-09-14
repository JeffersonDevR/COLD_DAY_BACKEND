package com.sena.cold_day.core.modules.ot.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-09: the authenticated technician polls the offers still open to it. The
 * profile is resolved from the principal, and closed windows are excluded so a
 * stale {@code PENDIENTE} row that the sweep has not resolved yet is never
 * presented as actionable (design D6 lazy check).
 */
@Service
public class ListarOfertasTecnicoUseCase {

    private final OfertaOtRepository ofertaRepository;
    private final TecnicoRepository tecnicoRepository;
    private final Clock clock;

    public ListarOfertasTecnicoUseCase(OfertaOtRepository ofertaRepository,
            TecnicoRepository tecnicoRepository, Clock clock) {
        this.ofertaRepository = ofertaRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<OfertaOt> listar(UsuarioId usuarioId) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        Instant ahora = clock.instant();
        return ofertaRepository.listarPorTecnico(tecnico.getId(), OfertaEstado.PENDIENTE).stream()
                .filter(oferta -> oferta.estaVigente(ahora))
                .toList();
    }
}
