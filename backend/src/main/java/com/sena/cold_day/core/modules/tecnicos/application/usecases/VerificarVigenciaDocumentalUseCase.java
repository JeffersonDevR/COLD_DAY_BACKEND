package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.events.DocumentoPorVencer;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.DocumentoTecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.services.NotificacionVigenciaPort;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;

/**
 * Daily documentary-vigencia sweep (RF-F1-03, CU-03). For every approved
 * technician it evaluates documents and certifications:
 * already-expired ones suspend habilitation; those inside the 30-day
 * pre-expiry window publish a notice to the technician and the administrator
 * WITHOUT suspending. Invoked directly with a fixed date in tests.
 */
@Service
public class VerificarVigenciaDocumentalUseCase {

    /** Pre-expiry notice window (RF-F1-03): 30 days before expiry. */
    public static final long DIAS_PREAVISO = 30;

    private final TecnicoRepository tecnicoRepository;
    private final DocumentoTecnicoRepository documentoRepository;
    private final NotificacionVigenciaPort notificacion;

    public VerificarVigenciaDocumentalUseCase(TecnicoRepository tecnicoRepository,
            DocumentoTecnicoRepository documentoRepository, NotificacionVigenciaPort notificacion) {
        this.tecnicoRepository = tecnicoRepository;
        this.documentoRepository = documentoRepository;
        this.notificacion = notificacion;
    }

    @Transactional
    public void ejecutar(LocalDate hoy) {
        for (Tecnico tecnico : tecnicoRepository.findByActivoTrue()) {
            if (tecnico.getEstadoValidacion() != EstadoValidacion.APROBADO) {
                continue;
            }
            boolean suspendido = false;
            for (DocumentoTecnico documento : documentoRepository.buscarPorTecnico(tecnico.getId())) {
                suspendido |= evaluar(tecnico, documento.getTipo(), documento.getFechaVencimiento(), hoy);
            }
            for (Certificacion certificacion : tecnico.getCertificaciones()) {
                suspendido |= evaluar(tecnico, certificacion.getNombre(), certificacion.getFechaVencimiento(), hoy);
            }
            if (suspendido) {
                tecnicoRepository.save(tecnico);
            }
        }
    }

    /** @return true when the technician was suspended by an already-expired item. */
    private boolean evaluar(Tecnico tecnico, String documento, LocalDate vencimiento, LocalDate hoy) {
        if (vencimiento == null) {
            return false;
        }
        if (vencimiento.isBefore(hoy)) {
            tecnico.suspenderPorVencimiento();
            return true;
        }
        if (!vencimiento.isAfter(hoy.plusDays(DIAS_PREAVISO))) {
            long diasRestantes = ChronoUnit.DAYS.between(hoy, vencimiento);
            notificacion.notificarProximoVencimiento(DocumentoPorVencer.paraTecnicoYAdministrador(
                    tecnico.getId(), documento, vencimiento, diasRestantes));
        }
        return false;
    }
}
