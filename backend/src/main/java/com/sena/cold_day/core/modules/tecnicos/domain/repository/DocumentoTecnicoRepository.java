package com.sena.cold_day.core.modules.tecnicos.domain.repository;

import java.util.List;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;

public interface DocumentoTecnicoRepository {

    List<DocumentoTecnico> buscarPorTecnico(Long tecnicoId);

    DocumentoTecnico save(DocumentoTecnico documento);
}
