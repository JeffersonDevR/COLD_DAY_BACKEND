package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import java.math.BigDecimal;
import java.time.Instant;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

/**
 * API view of an OT: identifiers are plain UUID strings and the state is an
 * enum name.
 */
public record OtApiResponse(
        String id,
        String clienteId,
        String tecnicoId,
        EstadoOt estado,
        CategoriaServicio categoriaServicio,
        String descripcionFalla,
        String direccion,
        double radioKm,
        Instant creadaEn,
        ActorOt canceladaPor,
        MotivoCancelacion motivoCancelacion,
        BigDecimal tarifaVisita,
        Diagnostico diagnostico,
        Presupuesto presupuesto) {

    public static OtApiResponse from(OtResponse response) {
        return new OtApiResponse(
                response.id() == null ? null : response.id().valor().toString(),
                response.clienteId() == null ? null : response.clienteId().valor().toString(),
                response.tecnicoId() == null ? null : response.tecnicoId().valor().toString(),
                response.estado(), response.categoriaServicio(), response.descripcionFalla(),
                response.direccion(), response.radioKm(), response.creadaEn(), response.canceladaPor(),
                response.motivoCancelacion(), response.tarifaVisita(), response.diagnostico(),
                response.presupuesto());
    }
}
