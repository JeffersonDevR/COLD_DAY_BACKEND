package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.IncumplimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.exception.CambioProveedorNoPermitidoException;
import com.sena.cold_day.core.modules.proveedores.domain.exception.RequerimientoInsumoNoEncontradoException;
import com.sena.cold_day.core.modules.proveedores.domain.repository.IncumplimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.services.NotificacionInsumoPort;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * The technician takes a request away from a supplier whose committed ETA elapsed
 * without a dispatch (design 2026-11-26). The same request reopens with a fresh
 * window and is broadcast again; the breach is recorded, with no sanction. The
 * conditional UPDATE is the gate: if the supplier dispatched in between, or the ETA
 * has not elapsed, nothing is written.
 */
@Service
public class CambiarProveedorInsumoUseCase {

    private static final Logger log = LoggerFactory.getLogger(CambiarProveedorInsumoUseCase.class);

    private final RequerimientoInsumoRepository requerimientoRepository;
    private final OfertaInsumoRepository ofertaRepository;
    private final IncumplimientoInsumoRepository incumplimientoRepository;
    private final SolicitarInsumoUseCase solicitarInsumo;
    private final NotificacionInsumoPort notificacion;
    private final Clock clock;
    private final long vigenciaMs;
    private final double radioInicialKm;

    @SuppressWarnings("java:S107") // Colaboradores del caso de uso mas dos valores de configuracion; no hay agrupacion natural.
    public CambiarProveedorInsumoUseCase(RequerimientoInsumoRepository requerimientoRepository,
            OfertaInsumoRepository ofertaRepository, IncumplimientoInsumoRepository incumplimientoRepository,
            SolicitarInsumoUseCase solicitarInsumo, NotificacionInsumoPort notificacion, Clock clock,
            @Value("${app.insumos.vigencia-ms:900000}") long vigenciaMs,
            @Value("${app.insumos.radio-inicial-km:10}") double radioInicialKm) {
        this.requerimientoRepository = requerimientoRepository;
        this.ofertaRepository = ofertaRepository;
        this.incumplimientoRepository = incumplimientoRepository;
        this.solicitarInsumo = solicitarInsumo;
        this.notificacion = notificacion;
        this.clock = clock;
        this.vigenciaMs = vigenciaMs;
        this.radioInicialKm = radioInicialKm;
    }

    @Transactional
    public RequerimientoInsumo cambiar(RequerimientoInsumoId id, UUID tecnicoId) {
        Instant ahora = clock.instant();
        // Another technician's request is reported as unknown, not as forbidden.
        RequerimientoInsumo actual = requerimientoRepository.buscarPorId(id)
                .filter(requerimiento -> requerimiento.getTecnicoId().equals(tecnicoId))
                .orElseThrow(() -> new RequerimientoInsumoNoEncontradoException(id));
        OfertaInsumo ganadora = ofertaRepository.buscarAceptada(id).orElseThrow(() -> noPermitido(actual));

        if (requerimientoRepository.reabrirSiEtaVencido(id, tecnicoId, ahora, ahora.plusMillis(vigenciaMs),
                radioInicialKm, ahora.plusMillis(solicitarInsumo.ventanaMs())) == 0) {
            throw noPermitido(requerimientoRepository.buscarPorId(id).orElse(actual));
        }
        ofertaRepository.reemplazarAceptada(id, ganadora.getProveedorId(), ahora);
        // The ETA and acceptance time come from the copy read before reopening cleared them.
        incumplimientoRepository.guardar(new IncumplimientoInsumo(UUID.randomUUID(), id,
                ganadora.getProveedorId(), actual.getEtaMinutos(), actual.getAceptadaEn(), ahora));

        RequerimientoInsumo reabierto = requerimientoRepository.buscarPorId(id)
                .orElseThrow(() -> new RequerimientoInsumoNoEncontradoException(id));
        solicitarInsumo.ofrecer(reabierto, radioInicialKm, ahora);
        NotificacionBestEffort.ejecutar(
                () -> notificacion.notificarReemplazado(ganadora.getProveedorId(), reabierto), log,
                "el reemplazo de proveedor en " + id);
        return reabierto;
    }

    private static CambioProveedorNoPermitidoException noPermitido(RequerimientoInsumo requerimiento) {
        boolean yaSalio = requerimiento.getEstado() == EstadoRequerimiento.DESPACHADO
                || requerimiento.getEstado() == EstadoRequerimiento.ENTREGADO;
        return new CambioProveedorNoPermitidoException(
                yaSalio ? "El proveedor ya despachó el pedido" : "Todavía no vence el tiempo prometido");
    }
}
