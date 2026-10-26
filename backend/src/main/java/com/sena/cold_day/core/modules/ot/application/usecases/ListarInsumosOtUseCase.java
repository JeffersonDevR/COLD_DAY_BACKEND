package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Read side of the parts requests attached to one OT (roadmap 2.4): the
 * assigned technician inspects the state of every
 * {@code RequerimientoInsumo} raised on his order to drive the "Repuestos"
 * screen. Pure query: it never mutates the OT or the request roots.
 *
 * <p>Guards mirror {@link RegistrarDiagnosticoUseCase}: unknown OT is 404 and
 * only the bound technician may read (403 otherwise). There is no lifecycle
 * condition here — terminal orders keep their history readable — and an OT
 * without requests yields an empty list, not an error.
 */
@Service
public class ListarInsumosOtUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final RequerimientoInsumoRepository requerimientoRepository;

    public ListarInsumosOtUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository,
            RequerimientoInsumoRepository requerimientoRepository) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.requerimientoRepository = requerimientoRepository;
    }

    /**
     * Returns the OT's requests newest first, so the retry the technician just
     * raised after {@code SIN_PROVEEDOR} is the first thing his UI shows.
     */
    @Transactional(readOnly = true)
    public List<RequerimientoInsumo> listar(UsuarioId usuarioId, OtId otId) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        if (!tecnico.getId().equals(ot.getTecnicoId())) {
            throw new TecnicoNoAsignadoException(otId, tecnico.getId());
        }

        return requerimientoRepository.buscarPorOt(ot.getId().valor()).stream()
                .sorted(Comparator.comparing(RequerimientoInsumo::getCreadaEn,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }
}
