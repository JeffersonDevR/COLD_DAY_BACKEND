package com.sena.cold_day.core.modules.ot.application.usecases;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.SolicitudInsumosInvalidaException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.proveedores.application.usecases.SolicitarInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Parts requests raised by the assigned technician outside the diagnóstico
 * flow (feature "repuestos a posteriori", roadmap 2.4): the técnico proposes
 * lines against an order that is already bound to him and not terminal, and
 * the broadcast/exiry/SIN_PROVEEDOR machinery is entirely reused.
 *
 * <p>The guards mirror {@link RegistrarDiagnosticoUseCase}: unknown OT is 404,
 * the caller must hold the active technician profile bound to the OT (403
 * otherwise), and the OT state has to be one of
 * {@code ASIGNADA, EN_CAMINO, EN_DIAGNOSTICO, EN_REPARACION, DISPUTADA}.
 * Explicitly disallowed are {@code SOLICITADA} and {@code BUSCANDO_TECNICO}
 * (the technician is not bound yet), {@code FINALIZADA} and {@code CANCELADA}
 * (terminal, design D2) and {@code SIN_TECNICOS_DISPONIBLES} (negative
 * terminal); {@code DISPUTADA} stays allowed because mediation does not
 * dissolve the assignment.
 *
 * <p>The request is a separate root that never mutates the OT lifecycle, and
 * there is no single-request invariant: every accepted call creates a fresh
 * {@code RequerimientoInsumo}, which is also what makes the
 * {@code SIN_PROVEEDOR} branch retriable.
 */
@Service
public class SolicitarInsumosOtUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final SolicitarInsumoUseCase solicitarInsumo;

    public SolicitarInsumosOtUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository,
            SolicitarInsumoUseCase solicitarInsumo) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.solicitarInsumo = solicitarInsumo;
    }

    @Transactional
    public Optional<RequerimientoInsumo> solicitar(UsuarioId usuarioId, OtId otId, List<InsumoLinea> lineas,
            String observaciones) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        if (!tecnico.getId().equals(ot.getTecnicoId())) {
            throw new TecnicoNoAsignadoException(otId, tecnico.getId());
        }
        if (!ESTADOS_PERMITIDOS.contains(ot.getEstado())) {
            throw new SolicitudInsumosInvalidaException(ot.getEstado());
        }

        // Same broadcast, same vigencia, same SIN_PROVEEDOR semantics as the
        // diagnóstico trigger: pass the ids resolved from the OT aggregate.
        return solicitarInsumo.solicitar(ot.getId().valor(), tecnico.getId().valor(), lineas, observaciones);
    }

    /** See the class javadoc for the exact allowed state set. */
    private static final Set<EstadoOt> ESTADOS_PERMITIDOS = EnumSet.of(
            EstadoOt.ASIGNADA, EstadoOt.EN_CAMINO, EstadoOt.EN_DIAGNOSTICO,
            EstadoOt.EN_REPARACION, EstadoOt.DISPUTADA);
}
