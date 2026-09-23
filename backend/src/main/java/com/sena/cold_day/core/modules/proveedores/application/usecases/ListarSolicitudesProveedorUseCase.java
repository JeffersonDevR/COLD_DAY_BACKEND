package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.application.dto.SolicitudProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Supplier-side poll of the insumo offers still open to it (spec disp.R3, design
 * flow (b)). The supplier is resolved from the authenticated principal — never
 * from the body — and an inactive or unknown supplier fails with
 * {@link ProveedorNoElegibleException} (403), never as an unhandled 500.
 *
 * <p>A stale {@code PENDIENTE} row whose window already closed is filtered out
 * with the shared {@link Clock} (lazy expiry), mirroring
 * {@code ListarOfertasTecnicoUseCase}, so a sweep lag never presents a dead
 * offer as actionable. Offers whose request cannot be read are dropped rather
 * than surfacing an inconsistent pair.
 */
@Service
public class ListarSolicitudesProveedorUseCase {

    private final OfertaInsumoRepository ofertaRepository;
    private final RequerimientoInsumoRepository requerimientoRepository;
    private final ProveedorRepository proveedorRepository;
    private final Clock clock;

    public ListarSolicitudesProveedorUseCase(OfertaInsumoRepository ofertaRepository,
            RequerimientoInsumoRepository requerimientoRepository, ProveedorRepository proveedorRepository,
            Clock clock) {
        this.ofertaRepository = ofertaRepository;
        this.requerimientoRepository = requerimientoRepository;
        this.proveedorRepository = proveedorRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<SolicitudProveedor> listar(UsuarioId usuarioId) {
        Proveedor proveedor = proveedorElegible(usuarioId);
        Instant ahora = clock.instant();
        return ofertaRepository.listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.PENDIENTE).stream()
                .filter(oferta -> oferta.estaVigente(ahora))
                .flatMap(oferta -> requerimientoRepository.buscarPorId(oferta.getRequerimientoId())
                        .map(requerimiento -> new SolicitudProveedor(oferta, requerimiento))
                        .stream())
                .toList();
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
