package com.sena.cold_day.core.modules.administracion.application.usecases;

import java.math.BigDecimal;
import java.time.Clock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.application.dto.LiquidacionResponse;
import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionRegistrada;
import com.sena.cold_day.core.modules.administracion.domain.exception.AdministracionConflictoException;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.exception.OtNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * CU-12 / RF-F1-23 / RF-F1-26: al cerrar un servicio liquidado en efectivo o
 * transferencia, el tecnico registra monto y medio, el sistema calcula la
 * comision adeudada a COLD DAY e inmoviliza al tecnico
 * ({@code BLOQUEADO_POR_LIQUIDACION}) hasta la aprobacion del comprobante.
 */
@Service
public class RegistrarPagoUseCase {

    private final OtRepository otRepository;
    private final TecnicoRepository tecnicoRepository;
    private final LiquidacionRepository liquidacionRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final BigDecimal porcentajeComision;

    public RegistrarPagoUseCase(OtRepository otRepository, TecnicoRepository tecnicoRepository,
            LiquidacionRepository liquidacionRepository, ApplicationEventPublisher events, Clock clock,
            @Value("${app.liquidacion.comision-porcentaje:0.15}") BigDecimal porcentajeComision) {
        this.otRepository = otRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.liquidacionRepository = liquidacionRepository;
        this.events = events;
        this.clock = clock;
        this.porcentajeComision = porcentajeComision;
    }

    @Transactional
    public LiquidacionResponse registrar(UsuarioId usuarioId, OtId otId, BigDecimal montoCobrado,
            MedioPago medioPago) {
        Ot ot = otRepository.buscarPorId(otId).orElseThrow(() -> new OtNoEncontradoException(otId));
        if (ot.getEstado() != EstadoOt.FINALIZADA) {
            throw new AdministracionConflictoException(
                    "Solo se puede registrar el pago de una orden FINALIZADA, estado actual: "
                            + ot.getEstado());
        }
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        if (!tecnico.getId().equals(ot.getTecnicoId())) {
            throw new TecnicoNoAsignadoException(otId, tecnico.getId());
        }
        if (liquidacionRepository.buscarPorOt(otId).isPresent()) {
            throw new AdministracionConflictoException(
                    "La orden ya tiene una liquidacion registrada");
        }

        Liquidacion liquidacion = Liquidacion.registrar(otId, tecnico.getId(), montoCobrado,
                medioPago, porcentajeComision, clock.instant());
        Liquidacion guardada = liquidacionRepository.save(liquidacion);
        tecnico.bloquearPorLiquidacion();
        tecnicoRepository.save(tecnico);
        events.publishEvent(new LiquidacionRegistrada(guardada.getId()));
        return LiquidacionResponse.fromDomain(guardada);
    }
}
