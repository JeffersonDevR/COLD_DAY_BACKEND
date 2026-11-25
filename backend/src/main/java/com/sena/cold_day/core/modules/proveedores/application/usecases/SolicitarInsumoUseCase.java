package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.CalculadoraEtaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorCercano;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * Trigger side of the insumo dispatch (spec disp.R1/R3/R6, design flow (b) and
 * the radius design of 2026-11-25): it builds the {@code RequerimientoInsumo} with
 * its free-text lines and broadcasts one pending {@code OfertaInsumo} to every
 * eligible supplier inside the initial radius around the delivery point. Zero
 * lines create nothing. Nobody inside the radius is not a failure: the request
 * stays {@code SOLICITADO} and {@code EscalarRadioInsumosUseCase} widens the
 * radius window by window; only the expiry sweep resolves it to
 * {@code SIN_PROVEEDOR}. The OT lifecycle is never touched.
 *
 * <p>The OT and the technician are received as plain {@code UUID}s and the
 * destination as a {@link Point} so this bounded context never imports
 * {@code ot}/{@code tecnico} domain types.
 *
 * <p>Notifications are best-effort (design AD11): they are sent only AFTER the
 * authoritative writes, each wrapped in try/catch, so a delivery failure never
 * changes the persisted request or its offers.
 */
@Service
public class SolicitarInsumoUseCase {

    private static final Logger log = LoggerFactory.getLogger(SolicitarInsumoUseCase.class);

    /** The radius windows split the total vigencia into this many equal slices (10, 15, 20, 25 km). */
    private static final int VENTANAS_POR_VIGENCIA = 4;

    private final RequerimientoInsumoRepository requerimientoRepository;
    private final OfertaInsumoRepository ofertaRepository;
    private final ProveedorRepository proveedorRepository;
    private final NotificacionInsumoPort notificacion;
    private final CalculadoraEtaInsumo calculadoraEta;
    private final Clock clock;
    private final long vigenciaMs;
    private final double radioInicialKm;

    @SuppressWarnings("java:S107") // Colaboradores del caso de uso mas dos valores de configuracion; no hay agrupacion natural.
    public SolicitarInsumoUseCase(RequerimientoInsumoRepository requerimientoRepository,
            OfertaInsumoRepository ofertaRepository, ProveedorRepository proveedorRepository,
            NotificacionInsumoPort notificacion, CalculadoraEtaInsumo calculadoraEta, Clock clock,
            @Value("${app.insumos.vigencia-ms:900000}") long vigenciaMs,
            @Value("${app.insumos.radio-inicial-km:10}") double radioInicialKm) {
        this.requerimientoRepository = requerimientoRepository;
        this.ofertaRepository = ofertaRepository;
        this.proveedorRepository = proveedorRepository;
        this.notificacion = notificacion;
        this.calculadoraEta = calculadoraEta;
        this.clock = clock;
        this.vigenciaMs = vigenciaMs;
        this.radioInicialKm = radioInicialKm;
    }

    /** Duration of one radius window: a quarter of the total vigencia. */
    public long ventanaMs() {
        return vigenciaMs / VENTANAS_POR_VIGENCIA;
    }

    /**
     * Creates and broadcasts a request for the declared lines. Returns empty when
     * no lines were declared (spec disp.R1: zero insumos create nothing).
     */
    @Transactional
    public Optional<RequerimientoInsumo> solicitar(UUID otId, UUID tecnicoId, Point destino,
            List<InsumoLinea> lineas, String observaciones) {
        if (lineas == null || lineas.isEmpty()) {
            return Optional.empty();
        }
        if (destino == null) {
            throw new IllegalArgumentException("El destino de la entrega es requerido");
        }

        Instant ahora = clock.instant();
        Instant expiraEn = ahora.plusMillis(vigenciaMs);
        RequerimientoInsumo requerimiento = RequerimientoInsumo.crear(otId, tecnicoId, lineas, observaciones,
                ahora, expiraEn, destino, radioInicialKm, ahora.plusMillis(ventanaMs()));

        RequerimientoInsumo guardado = requerimientoRepository.save(requerimiento);
        ofrecer(guardado, radioInicialKm, ahora);
        return Optional.of(guardado);
    }

    /**
     * Offers the request to every eligible supplier inside {@code radioKm} that
     * does not already hold an offer for it, and notifies each best-effort after
     * its offer is persisted. Offers live until the request's own expiry, so an
     * earlier ring keeps its chance while the radius widens. Returns how many
     * offers were created.
     */
    @Transactional
    public int ofrecer(RequerimientoInsumo requerimiento, double radioKm, Instant ahora) {
        Set<ProveedorId> yaOfertados = ofertaRepository.proveedoresOfertados(requerimiento.getId());
        int creadas = 0;
        for (ProveedorCercano cercano : proveedorRepository.buscarElegiblesEnRadio(requerimiento.getDestino(),
                radioKm)) {
            if (yaOfertados.contains(cercano.proveedorId())) {
                continue;
            }
            OfertaInsumo oferta = ofertaRepository.save(OfertaInsumo.crear(requerimiento.getId(),
                    cercano.proveedorId(), ahora, requerimiento.getExpiraEn(), cercano.distanciaKm(),
                    calculadoraEta.sugerir(cercano.distanciaKm())));
            notificar(cercano.proveedorId(), oferta, requerimiento);
            creadas++;
        }
        return creadas;
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
