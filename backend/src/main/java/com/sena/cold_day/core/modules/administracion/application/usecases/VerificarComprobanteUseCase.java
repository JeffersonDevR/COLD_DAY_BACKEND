package com.sena.cold_day.core.modules.administracion.application.usecases;

import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.application.dto.LiquidacionResponse;
import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionAprobada;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionRechazada;
import com.sena.cold_day.core.modules.administracion.domain.exception.LiquidacionNoEncontradaException;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * CU-13 / RF-F1-24: el administrador audita el comprobante de consignacion y lo
 * aprueba o rechaza. La aprobacion reactiva la habilitacion operativa del
 * tecnico de forma inmediata; el rechazo lo mantiene bloqueado.
 */
@Service
public class VerificarComprobanteUseCase {

    private final LiquidacionRepository liquidacionRepository;
    private final TecnicoRepository tecnicoRepository;
    private final UsuarioRepository usuarioRepository;
    private final OtRepository otRepository;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public VerificarComprobanteUseCase(LiquidacionRepository liquidacionRepository,
            TecnicoRepository tecnicoRepository, UsuarioRepository usuarioRepository,
            OtRepository otRepository, ApplicationEventPublisher events, Clock clock) {
        this.liquidacionRepository = liquidacionRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.usuarioRepository = usuarioRepository;
        this.otRepository = otRepository;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public LiquidacionResponse aprobar(LiquidacionId liquidacionId) {
        Liquidacion liquidacion = liquidacionRepository.buscarPorId(liquidacionId)
                .orElseThrow(() -> new LiquidacionNoEncontradaException(liquidacionId));
        liquidacion.aprobar(clock.instant());
        Liquidacion guardada = liquidacionRepository.save(liquidacion);
        Tecnico tecnico = tecnicoRepository.findByIdAndActivoTrue(guardada.getTecnicoId())
                .orElseThrow(() -> new TecnicoNoEncontradoException(guardada.getTecnicoId()));
        if (tecnico.estaBloqueadoPorLiquidacion()
                && !liquidacionRepository.existeBloqueadoraPara(tecnico.getId())) {
            tecnico.desbloquearTrasConsignacion();
            tecnicoRepository.save(tecnico);
        }
        events.publishEvent(new LiquidacionAprobada(guardada.getId()));
        return LiquidacionResponse.fromDomain(guardada).conOtCodigo(codigoDe(guardada.getOtId()));
    }

    @Transactional
    public LiquidacionResponse rechazar(LiquidacionId liquidacionId, String motivo) {
        Liquidacion liquidacion = liquidacionRepository.buscarPorId(liquidacionId)
                .orElseThrow(() -> new LiquidacionNoEncontradaException(liquidacionId));
        liquidacion.rechazar(motivo, clock.instant());
        Liquidacion guardada = liquidacionRepository.save(liquidacion);
        events.publishEvent(new LiquidacionRechazada(guardada.getId(), motivo));
        return LiquidacionResponse.fromDomain(guardada).conOtCodigo(codigoDe(guardada.getOtId()));
    }

    @Transactional(readOnly = true)
    public List<LiquidacionResponse> listarPendientes() {
        return enriquecer(liquidacionRepository.buscarPorEstado(EstadoLiquidacion.EN_VERIFICACION));
    }

    @Transactional(readOnly = true)
    public List<LiquidacionResponse> listarTodas() {
        return enriquecer(liquidacionRepository.listarTodas());
    }

    private List<LiquidacionResponse> enriquecer(List<Liquidacion> liquidaciones) {
        Map<UUID, String> nombres = new HashMap<>();
        return liquidaciones.stream()
                .map(liquidacion -> LiquidacionResponse.fromDomain(liquidacion).conTecnicoNombre(
                        liquidacion.getTecnicoId() == null ? null
                                : nombres.computeIfAbsent(liquidacion.getTecnicoId().valor(),
                                        this::nombreTecnico))
                        .conOtCodigo(codigoDe(liquidacion.getOtId())))
                .toList();
    }

    /**
     * Readable code of the liquidated order for the UI; null when the order is
     * not found. Only the display needs it, so a missing order never fails here.
     *
     * <p>shortcut: one OT lookup per row (no batch), because unlike a technician
     * a code never repeats inside a list; upgrade to {@code OtRepository#buscarPorIds}
     * if {@code listarTodas} ever holds enough rows for the extra queries to show.
     */
    private CodigoOt codigoDe(OtId otId) {
        return otRepository.buscarPorId(otId).map(Ot::getCodigo).orElse(null);
    }

    private String nombreTecnico(UUID tecnicoId) {
        return tecnicoRepository.findByIdAndActivoTrue(TecnicoId.desde(tecnicoId))
                .flatMap(tecnico -> usuarioRepository.buscarPorId(new UsuarioId(tecnico.getUsuarioId())))
                .map(Usuario::getNombre)
                .orElse(null);
    }
}
