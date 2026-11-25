package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.OfertaInsumoNoDisponibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.ProveedorNoElegibleException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.RequerimientoInsumoNoEncontradoException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.CalculadoraEtaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Atomic first-to-accept of an insumo request (spec disp.R3, design AD6/AD7).
 * The conditional UPDATE on the request root is the cross-offer gate: exactly one
 * concurrent accept can flip {@code SOLICITADO -> ASIGNADO}. The winner then
 * flips its own offer ({@code WHERE estado='PENDIENTE' AND expira_en > ahora}),
 * invalidates the siblings to {@code CANCELADA} and returns the assigned request.
 * Every loser receives a domain conflict and mutates nothing.
 *
 * <p>Eligibility is checked first (design AD7): only an active supplier with a
 * linked account may accept, and the offer must belong to it. An ineligible or
 * inactive supplier fails with {@link ProveedorNoElegibleException} (403), never
 * as an unhandled 500. Expired offers and requests are rejected lazily with the
 * injected {@link Clock}, so the sweep and the accept share one time source.
 */
@Service
public class AceptarInsumoUseCase {

    private static final Logger log = LoggerFactory.getLogger(AceptarInsumoUseCase.class);

    private final RequerimientoInsumoRepository requerimientoRepository;
    private final OfertaInsumoRepository ofertaRepository;
    private final ProveedorRepository proveedorRepository;
    private final CalculadoraEtaInsumo calculadoraEta;
    private final NotificacionInsumoPort notificacion;
    private final Clock clock;

    public AceptarInsumoUseCase(RequerimientoInsumoRepository requerimientoRepository,
            OfertaInsumoRepository ofertaRepository, ProveedorRepository proveedorRepository,
            CalculadoraEtaInsumo calculadoraEta, NotificacionInsumoPort notificacion, Clock clock) {
        this.requerimientoRepository = requerimientoRepository;
        this.ofertaRepository = ofertaRepository;
        this.proveedorRepository = proveedorRepository;
        this.calculadoraEta = calculadoraEta;
        this.notificacion = notificacion;
        this.clock = clock;
    }

    /**
     * Accepts the offer committing to {@code etaMinutos}, which must fall inside
     * the allowed range; an invalid ETA is rejected before anything is read or
     * written. The winner's offer distance is recorded with the ETA.
     */
    @Transactional
    public RequerimientoInsumo aceptar(UsuarioId usuarioId, OfertaInsumoId ofertaId, int etaMinutos) {
        calculadoraEta.validar(etaMinutos);
        Proveedor proveedor = proveedorElegible(usuarioId);
        Instant ahora = clock.instant();

        OfertaInsumo oferta = ofertaRepository.buscarPorId(ofertaId)
                .orElseThrow(() -> new OfertaInsumoNoDisponibleException(ofertaId));
        if (!proveedor.getId().equals(oferta.getProveedorId()) || !oferta.estaVigente(ahora)) {
            throw new OfertaInsumoNoDisponibleException(ofertaId);
        }

        RequerimientoInsumo requerimiento = requerimientoRepository.buscarPorId(oferta.getRequerimientoId())
                .orElseThrow(() -> new RequerimientoInsumoNoEncontradoException(oferta.getRequerimientoId()));
        if (!requerimiento.estaVigente(ahora)) {
            throw new OfertaInsumoNoDisponibleException(ofertaId);
        }

        // AD6: the root conditional UPDATE is the cross-offer gate (one winner).
        if (requerimientoRepository.intentarAsignar(requerimiento.getId(), ahora, etaMinutos,
                oferta.getDistanciaKm()) == 0) {
            throw new OfertaInsumoNoDisponibleException(ofertaId);
        }
        if (ofertaRepository.intentarAceptar(ofertaId, ahora) == 0) {
            throw new OfertaInsumoNoDisponibleException(ofertaId);
        }
        ofertaRepository.invalidarPendientesDe(requerimiento.getId(), OfertaInsumoEstado.CANCELADA, ahora);

        RequerimientoInsumo asignado = requerimientoRepository.buscarPorId(requerimiento.getId())
                .orElseThrow(() -> new RequerimientoInsumoNoEncontradoException(requerimiento.getId()));
        NotificacionBestEffort.ejecutar(() -> notificacion.notificarAceptada(asignado), log,
                "la aceptacion de " + asignado.getId());
        return asignado;
    }

    /**
     * Resolves the acting supplier and enforces the eligibility gate (AD7): a
     * linked account that is active AND whose documentation is approved. The
     * two checks are separate on purpose — {@code isActivo()} is an operator
     * action and raises {@link ProveedorNoElegibleException}, while
     * {@code exigirValidado()} is a documentary fact and raises
     * {@link ProveedorNoValidadoException}; both map to 403.
     */
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
