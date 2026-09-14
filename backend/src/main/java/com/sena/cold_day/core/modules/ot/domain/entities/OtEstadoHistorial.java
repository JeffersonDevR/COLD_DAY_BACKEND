package com.sena.cold_day.core.modules.ot.domain.entities;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.CambioEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * One immutable entry of an OT's state history (RNF-09). The aggregate drains
 * {@link CambioEstado} records into this entity; it is never updated or
 * deleted once appended.
 */
public class OtEstadoHistorial {

    private final Long id;
    private final OtId otId;
    private final CambioEstado cambio;
    private final Long actorUsuarioId;
    private final String actorRol;

    private OtEstadoHistorial(Long id, OtId otId, CambioEstado cambio, Long actorUsuarioId, String actorRol) {
        this.id = id;
        this.otId = otId;
        this.cambio = cambio;
        this.actorUsuarioId = actorUsuarioId;
        this.actorRol = actorRol;
    }

    /** New entry to append (id is assigned by persistence). */
    public static OtEstadoHistorial registrar(OtId otId, CambioEstado cambio) {
        return new OtEstadoHistorial(null, otId, cambio, null, null);
    }

    /** Rehydrates a persisted entry. */
    public static OtEstadoHistorial reconstituir(Long id, OtId otId, CambioEstado cambio,
            Long actorUsuarioId, String actorRol) {
        return new OtEstadoHistorial(id, otId, cambio, actorUsuarioId, actorRol);
    }

    public Long getId() {
        return id;
    }

    public OtId getOtId() {
        return otId;
    }

    public CambioEstado getCambio() {
        return cambio;
    }

    public Long getActorUsuarioId() {
        return actorUsuarioId;
    }

    public String getActorRol() {
        return actorRol;
    }
}
