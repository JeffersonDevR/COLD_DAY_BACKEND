package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses;

import java.time.Instant;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * API view of a technician. {@code id} is a plain UUID string so the wire
 * contract stays scalar (the domain {@code TecnicoId} record would otherwise
 * serialize as an object).
 *
 * <p>{@code token} is additive and only present on the second-profile
 * acquisition response: that call revokes the caller's previous token, so it
 * hands back the replacement. Every other read keeps the original wire shape
 * because a null token is omitted.
 */
public record TecnicoApiResponse(String id, Long usuarioId, String nombre, String correo, String telefono,
                                 String numeroIdentificacion, String fotoUrl, Set<CategoriaServicio> categoriasServicio,
                                 EstadoOperativo estadoOperativo, EstadoValidacion estadoValidacion, String motivoRechazoValidacion,
                                 Set<Certificacion> certificaciones, boolean activo,
                                 Point ubicacion, Instant ubicacionActualizadaEn,
                                 @JsonInclude(JsonInclude.Include.NON_NULL) String token) {

    public static TecnicoApiResponse from(TecnicoResponse response) {
        return conToken(response, null);
    }

    public static TecnicoApiResponse conToken(TecnicoResponse response, String token) {
        return new TecnicoApiResponse(String.valueOf(response.id()), response.usuarioId(), response.nombre(), response.correo(),
                response.telefono(), response.numeroIdentificacion(), response.fotoUrl(),
                response.categoriasServicio(), response.estadoOperativo(), response.estadoValidacion(),
                response.motivoRechazoValidacion(), response.certificaciones(), response.activo(),
                response.ubicacion(), response.ubicacionActualizadaEn(), token);
    }
}
