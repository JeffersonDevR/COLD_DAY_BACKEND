package com.sena.cold_day.core.modules.ot.application.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Diagnostico;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

/** Application-level view of an OT. */
public record OtResponse(
        OtId id,
        ClienteId clienteId,
        TecnicoId tecnicoId,
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
        Presupuesto presupuesto,
        Point ubicacion) {

    public static OtResponse fromDomain(Ot ot) {
        return new OtResponse(ot.getId(), ot.getClienteId(), ot.getTecnicoId(), ot.getEstado(),
                ot.getCategoriaServicio(), ot.getDescripcionFalla(), ot.getDireccion(), ot.getRadioKm(),
                ot.getCreadaEn(), ot.getCanceladaPor(), ot.getMotivoCancelacion(), ot.getTarifaVisita(),
                ot.getDiagnostico(), ot.getPresupuesto(), ot.getUbicacion());
    }
}
