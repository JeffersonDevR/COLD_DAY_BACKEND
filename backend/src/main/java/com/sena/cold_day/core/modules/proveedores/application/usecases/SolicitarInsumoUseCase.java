package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

/**
 * Trigger side of the insumo dispatch (spec disp.R1/R3/R6, design flow (b)): it
 * builds the {@code RequerimientoInsumo} with its free-text lines and broadcasts
 * one pending {@code OfertaInsumo} to every eligible active supplier. Zero lines
 * create nothing; zero eligible suppliers resolve the request to
 * {@code SIN_PROVEEDOR} without ever touching the OT lifecycle.
 *
 * <p>The OT and the technician are received as plain {@code UUID}s so this
 * bounded context never imports {@code ot}/{@code tecnico} domain types; the
 * diagnóstico wiring that calls this use case is slice 11.
 *
 * <p>Notifications are best-effort (design AD11): they are sent only AFTER the
 * authoritative writes, each wrapped in try/catch, so a delivery failure never
 * changes the persisted request or its offers.
 */
@Service
public class SolicitarInsumoUseCase {

    private static final Logger log = LoggerFactory.getLogger(SolicitarInsumoUseCase.class);

    private final RequerimientoInsumoRepository requerimientoRepository;
    private final OfertaInsumoRepository ofertaRepository;
    private final ProveedorRepository proveedorRepository;
    private final NotificacionInsumoPort notificacion;
    private final Clock clock;
    private final long vigenciaMs;

    public SolicitarInsumoUseCase(RequerimientoInsumoRepository requerimientoRepository,
            OfertaInsumoRepository ofertaRepository, ProveedorRepository proveedorRepository,
            NotificacionInsumoPort notificacion, Clock clock,
            @Value("${app.insumos.vigencia-ms:900000}") long vigenciaMs) {
        this.requerimientoRepository = requerimientoRepository;
        this.ofertaRepository = ofertaRepository;
        this.proveedorRepository = proveedorRepository;
        this.notificacion = notificacion;
        this.clock = clock;
        this.vigenciaMs = vigenciaMs;
    }

    /**
     * Creates and broadcasts a request for the declared lines. Returns empty when
     * no lines were declared (spec disp.R1: zero insumos create nothing).
     */
    @Transactional
    public Optional<RequerimientoInsumo> solicitar(UUID otId, UUID tecnicoId, List<InsumoLinea> lineas,
            String observaciones) {
        if (lineas == null || lineas.isEmpty()) {
            return Optional.empty();
        }

        Instant ahora = clock.instant();
        Instant expiraEn = ahora.plusMillis(vigenciaMs);
        RequerimientoInsumo requerimiento = RequerimientoInsumo.crear(otId, tecnicoId, lineas, observaciones,
                ahora, expiraEn);

        List<Proveedor> elegibles = proveedorRepository.findByActivoTrue();
        if (elegibles.isEmpty()) {
            // D6: no eligible supplier resolves the request; the OT is untouched.
            requerimiento.marcarSinProveedor(ahora);
            return Optional.of(requerimientoRepository.save(requerimiento));
        }

        RequerimientoInsumo guardado = requerimientoRepository.save(requerimiento);
        for (Proveedor proveedor : elegibles) {
            OfertaInsumo oferta = ofertaRepository
                    .save(OfertaInsumo.crear(guardado.getId(), proveedor.getId(), ahora, expiraEn));
            notificar(proveedor.getId(), oferta, guardado);
        }
        return Optional.of(guardado);
    }

    /** Best-effort delivery: a thrown transport error never escapes the use case. */
    private void notificar(ProveedorId proveedorId, OfertaInsumo oferta, RequerimientoInsumo requerimiento) {
        try {
            notificacion.notificarSolicitud(proveedorId, oferta, requerimiento);
        } catch (RuntimeException ex) {
            log.warn("No se pudo notificar la solicitud {} al proveedor {}: {}", requerimiento.getId(),
                    proveedorId, ex.getMessage());
        }
    }
}
