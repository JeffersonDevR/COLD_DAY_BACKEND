package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.OfertaInsumoNoDisponibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Explicit supplier decline of a held offer (spec disp.R5, design "State
 * Machines"). It records the spec-mandated {@code RECHAZADO} literal — never
 * {@code RECHAZADA} — and never binds the supplier. Only an eligible active
 * supplier that actually holds the offer may reject it.
 */
@Service
public class RechazarInsumoUseCase {

    private final OfertaInsumoRepository ofertaRepository;
    private final ProveedorRepository proveedorRepository;
    private final Clock clock;

    public RechazarInsumoUseCase(OfertaInsumoRepository ofertaRepository,
            ProveedorRepository proveedorRepository, Clock clock) {
        this.ofertaRepository = ofertaRepository;
        this.proveedorRepository = proveedorRepository;
        this.clock = clock;
    }

    @Transactional
    public OfertaInsumo rechazar(UsuarioId usuarioId, OfertaInsumoId ofertaId) {
        Proveedor proveedor = proveedorElegible(usuarioId);
        Instant ahora = clock.instant();

        OfertaInsumo oferta = ofertaRepository.buscarPorId(ofertaId)
                .orElseThrow(() -> new OfertaInsumoNoDisponibleException(ofertaId));
        if (!proveedor.getId().equals(oferta.getProveedorId()) || !oferta.estaVigente(ahora)) {
            throw new OfertaInsumoNoDisponibleException(ofertaId);
        }

        oferta.rechazar(ahora);
        return ofertaRepository.save(oferta);
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
