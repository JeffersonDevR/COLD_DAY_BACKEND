package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoValidado;
import com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoValidacionRechazada;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.DocumentacionIncompletaException;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.TecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.DocumentoTecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;

/**
 * CU-03: administrator reviews the DocumentoTecnico of the tecnico and
 * approves or rejects. Lives in tecnicos.application because it operates
 * directly on the Tecnico aggregate.
 */
@Service
public class ValidarDocumentacionTecnicoUseCase {

    private final TecnicoRepository tecnicoRepository;
    private final DocumentoTecnicoRepository documentoRepository;
    private final ApplicationEventPublisher events;

    public ValidarDocumentacionTecnicoUseCase(TecnicoRepository tecnicoRepository,
            DocumentoTecnicoRepository documentoRepository, ApplicationEventPublisher events) {
        this.tecnicoRepository = tecnicoRepository;
        this.documentoRepository = documentoRepository;
        this.events = events;
    }

    @Transactional
    public void aprobar(TecnicoId tecnicoId) {
        Tecnico tecnico = tecnicoRepository.findByIdAndActivoTrue(tecnicoId)
                .orElseThrow(() -> new TecnicoNoEncontradoException(tecnicoId));

        // Business rule: only approve if EVERY document is vigente.
        boolean todosVigentes = documentoRepository.buscarPorTecnico(tecnicoId).stream()
                .allMatch(DocumentoTecnico::estaVigente);
        if (!todosVigentes) {
            throw new DocumentacionIncompletaException(tecnicoId);
        }

        tecnico.aprobarValidacion();
        tecnicoRepository.save(tecnico);
        events.publishEvent(new TecnicoValidado(tecnicoId));
    }

    @Transactional
    public void rechazar(TecnicoId tecnicoId, String motivo) {
        Tecnico tecnico = tecnicoRepository.findByIdAndActivoTrue(tecnicoId)
                .orElseThrow(() -> new TecnicoNoEncontradoException(tecnicoId));
        tecnico.rechazarValidacion(motivo);
        tecnicoRepository.save(tecnico);
        events.publishEvent(new TecnicoValidacionRechazada(tecnicoId, motivo));
    }

    @Transactional
    public DocumentoTecnico registrarDocumento(TecnicoId tecnicoId, String tipo, java.time.LocalDate fechaVencimiento) {
        tecnicoRepository.findByIdAndActivoTrue(tecnicoId)
                .orElseThrow(() -> new TecnicoNoEncontradoException(tecnicoId));
        return documentoRepository.save(new DocumentoTecnico(null, tecnicoId, tipo, fechaVencimiento));
    }
}
