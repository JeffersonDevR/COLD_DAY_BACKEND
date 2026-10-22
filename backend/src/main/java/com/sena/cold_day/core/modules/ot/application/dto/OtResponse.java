package com.sena.cold_day.core.modules.ot.application.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
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
        CodigoOt codigo,
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
        Point ubicacion,
        int auxiliaresRequeridos,
        String medioPagoVisita,
        boolean visitaPagada,
        Integer calificacionEstrellas,
        String calificacionComentario,
        Instant calificacionEn,
        boolean actaFirmada,
        String actaCodigoVerificacion,
        Instant actaFirmadaEn,
        // Instant the assigned technician confirmed the arrival on site. It is a
        // fact, not a transition: null until the technician reports it.
        Instant llegadaEn,
        // Append-only state history of the order (RNF-09), oldest entry first.
        // It travels with the OT so the client can render the audit trail from
        // the same read it already makes, instead of asking for it separately.
        List<CambioEstado> historial) {

    public static OtResponse fromDomain(Ot ot) {
        return fromDomain(ot, List.of());
    }

    /**
     * Same view of the order, with its state history attached. The history is
     * read from the append-only table, never derived from the aggregate: the
     * aggregate only knows the changes that are still pending.
     */
    public static OtResponse fromDomain(Ot ot, List<CambioEstado> historial) {
        return new OtResponse(ot.getId(), ot.getCodigo(), ot.getClienteId(), ot.getTecnicoId(), ot.getEstado(),
                ot.getCategoriaServicio(), ot.getDescripcionFalla(), ot.getDireccion(), ot.getRadioKm(),
                ot.getCreadaEn(), ot.getCanceladaPor(), ot.getMotivoCancelacion(), ot.getTarifaVisita(),
                ot.getDiagnostico(), ot.getPresupuesto(), ot.getUbicacion(), ot.getAuxiliaresRequeridos(),
                ot.getMedioPagoVisita(), ot.getVisitaPagadaEn() != null, ot.getCalificacionEstrellas(),
                ot.getCalificacionComentario(), ot.getCalificacionEn(), ot.actaFirmada(),
                ot.getActaCodigoVerificacion() == null ? null : ot.getActaCodigoVerificacion().valor(),
                ot.getActaFirmadaEn(), ot.getLlegadaEn(), List.copyOf(historial));
    }
}
