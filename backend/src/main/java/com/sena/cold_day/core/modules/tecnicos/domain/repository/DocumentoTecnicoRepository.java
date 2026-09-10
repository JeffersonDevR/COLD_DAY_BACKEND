package com.sena.cold_day.core.modules.tecnicos.domain.repository;

import java.util.List;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import org.springframework.transaction.annotation.Transactional;

public interface DocumentoTecnicoRepository {



    @Transactional(readOnly = true)
    List<DocumentoTecnico> buscarPorTecnico(TecnicoId tecnicoId);

    DocumentoTecnico save(DocumentoTecnico documento);
}
