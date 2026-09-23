package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;

/**
 * Server-authoritative expiry sweep (spec disp.R4, design AD6). It closes every
 * pending offer whose window passed to {@code EXPIRADA} and resolves every
 * still-open request past its window to {@code SIN_PROVEEDOR}, without ever
 * touching the OT lifecycle. Both primitives are conditional bulk UPDATEs, so the
 * sweep is idempotent and safe to run concurrently with acceptances.
 *
 * <p>This is the single sweep path: {@code ProgramadorExpiracionInsumo} calls
 * this use case instead of the repository primitives directly (slice 9 flagged
 * the re-point so no duplicate sweep logic remains).
 */
@Service
public class ExpirarInsumosUseCase {

    private final OfertaInsumoRepository ofertaRepository;
    private final RequerimientoInsumoRepository requerimientoRepository;
    private final Clock clock;

    public ExpirarInsumosUseCase(OfertaInsumoRepository ofertaRepository,
            RequerimientoInsumoRepository requerimientoRepository, Clock clock) {
        this.ofertaRepository = ofertaRepository;
        this.requerimientoRepository = requerimientoRepository;
        this.clock = clock;
    }

    @Transactional
    public Resultado expirar() {
        Instant ahora = clock.instant();
        int ofertasExpiradas = ofertaRepository.expirarVencidas(ahora);
        int requerimientosSinProveedor = requerimientoRepository.expirarVencidos(ahora);
        return new Resultado(ofertasExpiradas, requerimientosSinProveedor);
    }

    /** Counts of what the sweep closed, for the sweeper log and for tests. */
    public record Resultado(int ofertasExpiradas, int requerimientosSinProveedor) {
    }
}
