package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;

/**
 * Radius escalation sweep for insumo requests (design 2026-11-25), the supplier
 * counterpart of {@code EscalarRadioUseCase}. For every open request whose current
 * window closed with no accepting supplier it widens the radius by
 * {@code app.insumos.incremento-km} (10 -&gt; 15 -&gt; 20 -&gt; 25 by default, never past
 * {@code app.insumos.radio-maximo-km}) and offers it to the suppliers of the new
 * ring. Offers already sent stay valid until the request's own expiry, so the
 * closer suppliers keep their turn.
 *
 * <p>Past the maximum radius nothing happens here: the request simply waits for
 * {@link ExpirarInsumosUseCase}, which resolves it to {@code SIN_PROVEEDOR}.
 * Requests that predate V21 carry no radius and are ignored.
 */
@Service
public class EscalarRadioInsumosUseCase {

    private final RequerimientoInsumoRepository requerimientoRepository;
    private final SolicitarInsumoUseCase solicitarInsumo;
    private final Clock clock;
    private final double radioMaximoKm;
    private final double incrementoKm;

    public EscalarRadioInsumosUseCase(RequerimientoInsumoRepository requerimientoRepository,
            SolicitarInsumoUseCase solicitarInsumo, Clock clock,
            @Value("${app.insumos.radio-maximo-km:25}") double radioMaximoKm,
            @Value("${app.insumos.incremento-km:5}") double incrementoKm) {
        this.requerimientoRepository = requerimientoRepository;
        this.solicitarInsumo = solicitarInsumo;
        this.clock = clock;
        this.radioMaximoKm = radioMaximoKm;
        this.incrementoKm = incrementoKm;
    }

    /** Escalates every due request and returns how many were widened in this sweep. */
    @Transactional
    public int ejecutar() {
        Instant ahora = clock.instant();
        List<RequerimientoInsumo> vencidas = requerimientoRepository.buscarEscalables(ahora);
        int escaladas = 0;
        for (RequerimientoInsumo requerimiento : vencidas) {
            if (requerimiento.getRadioKm() == null || requerimiento.getRadioKm() >= radioMaximoKm) {
                continue;
            }
            if (escalar(requerimiento, ahora)) {
                escaladas++;
            }
        }
        return escaladas;
    }

    /**
     * The widening is a conditional UPDATE, never a save of the copy loaded by this
     * sweep: if a supplier accepted in between, it matches nothing and the
     * acceptance is left untouched (no new ring is offered for a taken request).
     */
    private boolean escalar(RequerimientoInsumo requerimiento, Instant ahora) {
        double nuevoRadio = Math.min(requerimiento.getRadioKm() + incrementoKm, radioMaximoKm);
        Instant nuevaVentana = ahora.plusMillis(solicitarInsumo.ventanaMs());
        if (nuevaVentana.isAfter(requerimiento.getExpiraEn())) {
            nuevaVentana = requerimiento.getExpiraEn();
        }
        if (requerimientoRepository.escalarSiAbierto(requerimiento.getId(), nuevoRadio, nuevaVentana) == 0) {
            return false;
        }
        requerimiento.escalar(nuevoRadio, nuevaVentana);
        solicitarInsumo.ofrecer(requerimiento, nuevoRadio, ahora);
        return true;
    }
}
