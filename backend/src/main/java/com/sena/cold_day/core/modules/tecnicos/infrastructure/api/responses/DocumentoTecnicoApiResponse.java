package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;

public record DocumentoTecnicoApiResponse(Long id, Long tecnicoId, String tipo,
        java.time.LocalDate fechaVencimiento, boolean vigente) {

    public static DocumentoTecnicoApiResponse from(DocumentoTecnico documento) {
        return new DocumentoTecnicoApiResponse(documento.getId(), documento.getTecnicoId(), documento.getTipo(),
                documento.getFechaVencimiento(), documento.estaVigente());
    }
}
