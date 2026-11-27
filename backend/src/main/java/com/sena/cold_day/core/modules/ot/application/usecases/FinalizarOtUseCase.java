package com.sena.cold_day.core.modules.ot.application.usecases;

import java.math.BigDecimal;
import org.springframework.beans.factory.annotation.Value;
import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionRegistrada;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import java.time.Clock;
import java.time.Instant;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.events.OtFinalizada;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-10: the assigned technician finishes the repair
 * ({@code EN_REPARACION -> FINALIZADA}), the technician is released back to
 * {@code DISPONIBLE} and {@link OtFinalizada} is published so real-time
 * tracking deactivates while the final coordinates remain for audit.
 *
 * <p>Al cerrar tambien se liquida el cobro (presupuesto mas visita): el tecnico
 * queda bloqueado hasta que se apruebe su consignacion (RF-F1-23). Se hace aqui,
 * en la misma transaccion, para que no dependa de un paso aparte del telefono.
 */
@Service
public class FinalizarOtUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final EstimarTarifaUseCase estimarTarifa;
    private final LiquidacionRepository liquidacionRepository;
    private final BigDecimal porcentajeComision;

    public FinalizarOtUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository,
            ApplicationEventPublisher events, Clock clock, EstimarTarifaUseCase estimarTarifa,
            LiquidacionRepository liquidacionRepository,
            @Value("${app.liquidacion.comision-porcentaje:0.15}") BigDecimal porcentajeComision) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.events = events;
        this.clock = clock;
        this.estimarTarifa = estimarTarifa;
        this.liquidacionRepository = liquidacionRepository;
        this.porcentajeComision = porcentajeComision;
    }

    /** Clientes que aun no envian el medio de pago: se registra como efectivo. */
    @Transactional
    public OtResponse finalizar(UsuarioId usuarioId, OtId otId) {
        return finalizar(usuarioId, otId, null);
    }

    @Transactional
    public OtResponse finalizar(UsuarioId usuarioId, OtId otId, MedioPago medioPago) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        if (!tecnico.getId().equals(ot.getTecnicoId())) {
            throw new TecnicoNoAsignadoException(otId, tecnico.getId());
        }

        Instant ahora = clock.instant();
        ot.finalizar(ActorOt.TECNICO, ahora);
        registrarTarifaAutoritativa(ot, ahora);
        Ot saved = otRepository.save(ot);
        boolean liquidada = liquidar(saved, tecnico, medioPago == null ? MedioPago.EFECTIVO : medioPago, ahora);
        // Un tecnico suspendido a mitad de la orden no admite el bloqueo: se libera
        // como antes y la deuda sigue impidiendo que vuelva a estar disponible.
        if (liquidada && tecnico.getEstadoValidacion() == EstadoValidacion.APROBADO) {
            tecnico.bloquearPorLiquidacion();
        } else {
            tecnico.liberarOrden();
        }
        tecnicoRepository.save(tecnico);
        events.publishEvent(new OtFinalizada(otId, saved.getTecnicoId()));
        return OtResponse.fromDomain(saved);
    }

    private boolean liquidar(Ot ot, Tecnico tecnico, MedioPago medioPago, Instant ahora) {
        if (ot.getPresupuesto() == null || liquidacionRepository.buscarPorOt(ot.getId()).isPresent()) {
            return false;
        }
        BigDecimal visita = ot.getTarifaVisita() == null ? BigDecimal.ZERO : ot.getTarifaVisita();
        BigDecimal total = ot.getPresupuesto().costoManoObra()
                .add(ot.getPresupuesto().costoRepuestos())
                .add(visita);
        if (total.signum() <= 0) {
            return false;
        }
        Liquidacion guardada = liquidacionRepository.save(Liquidacion.registrar(ot.getId(), tecnico.getId(),
                total, medioPago, porcentajeComision, ahora));
        events.publishEvent(new LiquidacionRegistrada(guardada.getId()));
        return true;
    }

    /**
     * Persists the authoritative visit tariff for the OT's destination. A
     * location-less OT (legacy row) has no destination to price, so no tariff,
     * distance or source is persisted — an explicit, observable no-op rather
     * than a silent skip (tar.R6).
     */
    private void registrarTarifaAutoritativa(Ot ot, Instant ahora) {
        if (ot.getUbicacion() == null) {
            return;
        }
        estimarTarifa.estimarPara(ot.getUbicacion()).ifPresent(tarifa -> ot.registrarTarifaVisita(
                tarifa.tarifa(), tarifa.distanciaKm(), tarifa.tarifaFuente(), ahora));
    }
}
