package com.sena.cold_day.core.modules.administracion.application.usecases;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.administracion.application.dto.LiquidacionResponse;
import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.events.ComprobanteCargado;
import com.sena.cold_day.core.modules.administracion.domain.exception.LiquidacionNoEncontradaException;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.ot.domain.exception.TecnicoNoAsignadoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * RF-F1-24: el tecnico carga la imagen del comprobante de
 * transferencia/consignacion bancaria para verificacion del administrador.
 */
@Service
public class CargarComprobanteUseCase {

    private final LiquidacionRepository liquidacionRepository;
    private final TecnicoRepository tecnicoRepository;
    private final ApplicationEventPublisher events;

    public CargarComprobanteUseCase(LiquidacionRepository liquidacionRepository,
            TecnicoRepository tecnicoRepository, ApplicationEventPublisher events) {
        this.liquidacionRepository = liquidacionRepository;
        this.tecnicoRepository = tecnicoRepository;
        this.events = events;
    }

    @Transactional
    public LiquidacionResponse cargar(UsuarioId usuarioId, LiquidacionId liquidacionId,
            String comprobanteUrl) {
        Liquidacion liquidacion = liquidacionRepository.buscarPorId(liquidacionId)
                .orElseThrow(() -> new LiquidacionNoEncontradaException(liquidacionId));
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        if (!tecnico.getId().equals(liquidacion.getTecnicoId())) {
            throw new TecnicoNoAsignadoException(liquidacion.getOtId(), tecnico.getId());
        }
        liquidacion.cargarComprobante(comprobanteUrl);
        Liquidacion guardada = liquidacionRepository.save(liquidacion);
        events.publishEvent(new ComprobanteCargado(guardada.getId()));
        return LiquidacionResponse.fromDomain(guardada);
    }
}
