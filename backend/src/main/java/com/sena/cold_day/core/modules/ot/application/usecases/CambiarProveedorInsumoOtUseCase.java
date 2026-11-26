package com.sena.cold_day.core.modules.ot.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.application.usecases.CambiarProveedorInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Resolves the authenticated technician and delegates the supplier change, so the
 * {@code proveedores} application layer never imports {@code tecnicos} types.
 */
@Service
public class CambiarProveedorInsumoOtUseCase {

    private final TecnicoRepository tecnicoRepository;
    private final CambiarProveedorInsumoUseCase cambiarProveedor;

    public CambiarProveedorInsumoOtUseCase(TecnicoRepository tecnicoRepository,
            CambiarProveedorInsumoUseCase cambiarProveedor) {
        this.tecnicoRepository = tecnicoRepository;
        this.cambiarProveedor = cambiarProveedor;
    }

    @Transactional
    public RequerimientoInsumo cambiar(UsuarioId usuarioId, RequerimientoInsumoId requerimientoId) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        return cambiarProveedor.cambiar(requerimientoId, tecnico.getId().valor());
    }
}
