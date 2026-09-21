package com.sena.cold_day.core.modules.tecnicos.application.usecases;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.exception.PerfilTecnicoNoEncontradoException;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.DocumentoTecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/** Lists the documentos of the authenticated técnico. */
@Service
public class ListarDocumentosTecnicoUseCase {

    private final DocumentoTecnicoRepository documentoRepository;
    private final TecnicoRepository tecnicoRepository;

    public ListarDocumentosTecnicoUseCase(DocumentoTecnicoRepository documentoRepository,
            TecnicoRepository tecnicoRepository) {
        this.documentoRepository = documentoRepository;
        this.tecnicoRepository = tecnicoRepository;
    }

    @Transactional(readOnly = true)
    public List<DocumentoTecnico> listar(UsuarioId usuarioId) {
        Tecnico tecnico = tecnicoRepository.findByUsuarioIdAndActivoTrue(usuarioId.valor())
                .orElseThrow(() -> new PerfilTecnicoNoEncontradoException(usuarioId.valor()));
        return documentoRepository.buscarPorTecnico(tecnico.getId());
    }
}
