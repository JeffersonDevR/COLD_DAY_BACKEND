package com.sena.cold_day.core.modules.ot.application.usecases;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.proveedores.application.usecases.CambiarProveedorInsumoUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.CambioProveedorNoPermitidoException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Resolves the authenticated technician and delegates the supplier change, so the
 * {@code proveedores} application layer never imports {@code tecnicos} or {@code ot}
 * types. A closed OT is rejected here: broadcasting parts for it would send suppliers
 * to a job that no longer exists.
 */
@Service
public class CambiarProveedorInsumoOtUseCase {

    private final TecnicoRepository tecnicoRepository;
    private final CambiarProveedorInsumoUseCase cambiarProveedor;
    private final RequerimientoInsumoRepository requerimientoRepository;
    private final OtRepository otRepository;

    public CambiarProveedorInsumoOtUseCase(TecnicoRepository tecnicoRepository,
            CambiarProveedorInsumoUseCase cambiarProveedor,
            RequerimientoInsumoRepository requerimientoRepository, OtRepository otRepository) {
        this.requerimientoRepository = requerimientoRepository;
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.cambiarProveedor = cambiarProveedor;
    }

    @Transactional
    public RequerimientoInsumo cambiar(UsuarioId usuarioId, RequerimientoInsumoId requerimientoId) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        // Only for the owner's own request: anyone else must keep getting "not found".
        boolean ordenCerrada = requerimientoRepository.buscarPorId(requerimientoId)
                .filter(requerimiento -> tecnico.getId().valor().equals(requerimiento.getTecnicoId()))
                .flatMap(requerimiento -> otRepository.buscarPorId(new OtId(requerimiento.getOtId())))
                .map(ot -> ot.getEstado().esTerminal())
                .orElse(false);
        if (ordenCerrada) {
            throw new CambioProveedorNoPermitidoException("La orden de trabajo ya está cerrada");
        }
        return cambiarProveedor.cambiar(requerimientoId, tecnico.getId().valor());
    }
}
