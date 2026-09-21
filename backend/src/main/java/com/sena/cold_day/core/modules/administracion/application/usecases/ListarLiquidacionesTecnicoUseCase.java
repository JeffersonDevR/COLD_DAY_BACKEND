package com.sena.cold_day.core.modules.administracion.application.usecases;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.application.dto.LiquidacionResponse;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
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

    public ListarLiquidacionesTecnicoUseCase(LiquidacionRepository liquidacionRepository,
            TecnicoRepository tecnicoRepository, UsuarioRepository usuarioRepository) {
        this.liquidacionRepository = liquidacionRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<LiquidacionResponse> listar(UsuarioId usuarioId) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        String nombre = usuarioRepository.buscarPorId(usuarioId).map(Usuario::getNombre).orElse(null);
        return liquidacionRepository.buscarPorTecnico(tecnico.getId()).stream()
                .map(liquidacion -> LiquidacionResponse.fromDomain(liquidacion).conTecnicoNombre(nombre))
                .toList();
    }
}
