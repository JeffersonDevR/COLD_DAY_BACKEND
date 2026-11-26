package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.PedidoReemplazadoException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.TransicionRequerimientoInvalidaException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.RequerimientoInsumoNoEncontradoException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Dispatch step of an accepted insumo request (design 2026-11-25): the supplier
 * that won the request sends the order out, moving {@code ASIGNADO -> DESPACHADO}.
 * It follows the same rules as {@link EntregarInsumoUseCase}: the actor must be an
 * active, approved supplier whose offer is {@code ACEPTADA} for this request (any
 * other supplier is rejected as ineligible, 403), and a request that is not
 * {@code ASIGNADO} fails the transition guard (409) instead of dispatching.
 */
@Service
public class DespacharInsumoUseCase {

    private static final Logger log = LoggerFactory.getLogger(DespacharInsumoUseCase.class);

    private final RequerimientoInsumoRepository requerimientoRepository;
    private final OfertaInsumoRepository ofertaRepository;
    private final ProveedorRepository proveedorRepository;
    private final NotificacionInsumoPort notificacion;
    private final Clock clock;

    public DespacharInsumoUseCase(RequerimientoInsumoRepository requerimientoRepository,
            OfertaInsumoRepository ofertaRepository, ProveedorRepository proveedorRepository,
            NotificacionInsumoPort notificacion, Clock clock) {
        this.requerimientoRepository = requerimientoRepository;
        this.ofertaRepository = ofertaRepository;
        this.proveedorRepository = proveedorRepository;
        this.notificacion = notificacion;
        this.clock = clock;
    }

    @Transactional
    public RequerimientoInsumo despachar(UsuarioId usuarioId, RequerimientoInsumoId requerimientoId) {
        Proveedor proveedor = proveedorElegible(usuarioId);
        Instant ahora = clock.instant();

        RequerimientoInsumo requerimiento = requerimientoRepository.buscarPorId(requerimientoId)
                .orElseThrow(() -> new RequerimientoInsumoNoEncontradoException(requerimientoId));

        // Before the eligibility check: a replaced supplier gets told why, not "forbidden".
        if (ofertaRepository.fueReemplazado(requerimientoId, proveedor.getId())) {
            throw new PedidoReemplazadoException();
        }
        boolean asignadoAProveedor = ofertaRepository
                .listarPorProveedor(proveedor.getId(), OfertaInsumoEstado.ACEPTADA).stream()
                .anyMatch(oferta -> requerimientoId.equals(oferta.getRequerimientoId()));
        if (!asignadoAProveedor) {
            throw new ProveedorNoElegibleException(usuarioId.valor());
        }

        requerimiento.despachar(ahora);
        // Conditional write, not a save of the loaded copy: the technician may be
        // moving the request to another supplier at this very moment.
        if (requerimientoRepository.despacharSiAsignado(requerimientoId, proveedor.getId(), ahora) == 0) {
            if (ofertaRepository.fueReemplazado(requerimientoId, proveedor.getId())) {
                throw new PedidoReemplazadoException();
            }
            throw new TransicionRequerimientoInvalidaException(EstadoRequerimiento.ASIGNADO,
                    EstadoRequerimiento.DESPACHADO);
        }
        RequerimientoInsumo despachado = requerimiento;
        NotificacionBestEffort.ejecutar(() -> notificacion.notificarDespachada(despachado), log,
                "el despacho de " + despachado.getId());
        return despachado;
    }

    /** Active AND documentary validation approved: the full eligibility gate (AD7). */
    private Proveedor proveedorElegible(UsuarioId usuarioId) {
        Proveedor proveedor = proveedorRepository.findByUsuarioId(usuarioId.valor())
                .orElseThrow(() -> new ProveedorNoElegibleException(usuarioId.valor()));
        if (!proveedor.isActivo()) {
            throw new ProveedorNoElegibleException(usuarioId.valor());
        }
        proveedor.exigirValidado();
        return proveedor;
    }
}
