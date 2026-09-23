package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.RequerimientoInsumoNoEncontradoException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Delivery confirmation (spec disp.R7, design AD8): the supplier that won the
 * request confirms delivery at the technician's service location, moving
 * {@code ASIGNADO -> ENTREGADO}. Only the winning supplier — the one whose offer
 * is {@code ACEPTADA} for this request — may confirm; any other supplier is
 * rejected as ineligible (403), and a request that is not assigned fails the
 * transition guard rather than delivering.
 */
@Service
public class EntregarInsumoUseCase {

    private final RequerimientoInsumoRepository requerimientoRepository;
    private final OfertaInsumoRepository ofertaRepository;
    private final ProveedorRepository proveedorRepository;
    private final Clock clock;

    public EntregarInsumoUseCase(RequerimientoInsumoRepository requerimientoRepository,
            OfertaInsumoRepository ofertaRepository, ProveedorRepository proveedorRepository, Clock clock) {
        this.requerimientoRepository = requerimientoRepository;
        this.ofertaRepository = ofertaRepository;
        this.proveedorRepository = proveedorRepository;
        this.clock = clock;
    }

    @Transactional
    public RequerimientoInsumo entregar(UsuarioId usuarioId, RequerimientoInsumoId requerimientoId) {
        Proveedor proveedor = proveedorElegible(usuarioId);
        Instant ahora = clock.instant();

        RequerimientoInsumo requerimiento = requerimientoRepository.buscarPorId(requerimientoId)
                .orElseThrow(() -> new RequerimientoInsumoNoEncontradoException(requerimientoId));

        boolean asignadoAProveedor = ofertaRepository
                .listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA).stream()
                .anyMatch(oferta -> requerimientoId.equals(oferta.getRequerimientoId()));
        if (!asignadoAProveedor) {
            throw new ProveedorNoElegibleException(usuarioId.valor());
        }

        requerimiento.marcarEntregado(ahora);
        return requerimientoRepository.save(requerimiento);
    }

    /** Resolves the acting supplier and enforces the active/linked-account gate (AD7). */
    private Proveedor proveedorElegible(UsuarioId usuarioId) {
        Proveedor proveedor = proveedorRepository.findByUsuarioId(usuarioId.valor())
                .orElseThrow(() -> new ProveedorNoElegibleException(usuarioId.valor()));
        if (!proveedor.isActivo()) {
            throw new ProveedorNoElegibleException(usuarioId.valor());
        }
        return proveedor;
    }
}
