package com.sena.cold_day.core.modules.administracion.application.usecases;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.application.dto.LiquidacionResponse;
import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Lists the liquidaciones of the authenticated técnico (RF-F1-24). */
@Service
public class ListarLiquidacionesTecnicoUseCase {

    private final LiquidacionRepository liquidacionRepository;
    private final TecnicoRepository tecnicoRepository;
    private final UsuarioRepository usuarioRepository;
    private final OtRepository otRepository;

    public ListarLiquidacionesTecnicoUseCase(LiquidacionRepository liquidacionRepository,
            TecnicoRepository tecnicoRepository, UsuarioRepository usuarioRepository,
            OtRepository otRepository) {
        this.liquidacionRepository = liquidacionRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
        this.otRepository = otRepository;
    }

    @Transactional(readOnly = true)
    public List<LiquidacionResponse> listar(UsuarioId usuarioId) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        String nombre = usuarioRepository.buscarPorId(usuarioId).map(Usuario::getNombre).orElse(null);
        var liquidaciones = liquidacionRepository.buscarPorTecnico(tecnico.getId());
        if (liquidaciones.isEmpty()) {
            return List.of();
        }
        // Una sola lectura de OT para la lista entera: antes era una query por fila.
        Map<OtId, Ot> ots = otRepository
                .buscarPorIds(liquidaciones.stream().map(Liquidacion::getOtId).toList())
                .stream()
                .collect(Collectors.toMap(Ot::getId, ot -> ot, (primera, segunda) -> primera));
        return liquidaciones.stream()
                .map(liquidacion -> LiquidacionResponse.fromDomain(liquidacion)
                        .conTecnicoNombre(nombre).conOtCodigo(codigoDe(ots, liquidacion.getOtId())))
                .toList();
    }

    /** Codigo legible de la OT; null si no existe. Ya resuelto en lote. */
    private CodigoOt codigoDe(Map<OtId, Ot> ots, OtId otId) {
        Ot ot = ots.get(otId);
        return ot == null ? null : ot.getCodigo();
    }
}
