package com.sena.cold_day.core.modules.administracion.domain.entities;

import java.time.Instant;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * Mediacion administrativa de una OT en disputa (RF-F1-25, SRS §5.3).
 * El cliente abre la disputa al rechazar el diagnostico o el trabajo; el
 * administrador la resuelve con acuerdo (FINALIZADA) o sin acuerdo
 * (CANCELADA sin cobro).
 */
public class Disputa {

    private DisputaId id;
    private OtId otId;
    private String motivo;
    private EstadoDisputa estado;
    private String resolucion;
    private Instant creadaEn;
    private Instant resueltaEn;

    private Disputa() {
    }

    public static Disputa abrir(OtId otId, String motivo, Instant ahora) {
        if (otId == null) {
            throw new IllegalArgumentException("La orden de trabajo es requerida");
        }
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("El motivo de la disputa es requerido");
        }
        if (ahora == null) {
            throw new IllegalArgumentException("El momento de apertura es requerido");
        }
        Disputa disputa = new Disputa();
        disputa.id = DisputaId.nueva();
        disputa.otId = otId;
        disputa.motivo = motivo;
        disputa.estado = EstadoDisputa.ABIERTA;
        disputa.creadaEn = ahora;
        return disputa;
    }

    public static Disputa reconstituir(DisputaId id, OtId otId, String motivo, EstadoDisputa estado,
            String resolucion, Instant creadaEn, Instant resueltaEn) {
        Disputa disputa = new Disputa();
        disputa.id = id;
        disputa.otId = otId;
        disputa.motivo = motivo;
        disputa.estado = estado;
        disputa.resolucion = resolucion;
        disputa.creadaEn = creadaEn;
        disputa.resueltaEn = resueltaEn;
        return disputa;
    }

    /** Cierre con acuerdo: la OT se finaliza (RF-F1-25). */
    public void resolverConAcuerdo(String resolucion, Instant ahora) {
        exigirAbierta();
        if (resolucion == null || resolucion.isBlank()) {
            throw new IllegalArgumentException("La resolucion es requerida");
        }
        this.estado = EstadoDisputa.RESUELTA_CON_ACUERDO;
        this.resolucion = resolucion;
        this.resueltaEn = ahora;
    }

    /** Cierre sin acuerdo: la OT se cancela sin cobro (RF-F1-25). */
    public void resolverSinAcuerdo(String resolucion, Instant ahora) {
        exigirAbierta();
        if (resolucion == null || resolucion.isBlank()) {
            throw new IllegalArgumentException("La resolucion es requerida");
        }
        this.estado = EstadoDisputa.RESUELTA_SIN_ACUERDO;
        this.resolucion = resolucion;
        this.resueltaEn = ahora;
    }

    private void exigirAbierta() {
        if (estado != EstadoDisputa.ABIERTA) {
            throw new IllegalStateException(
                    "Solo se puede resolver una disputa ABIERTA, estado actual: " + estado);
        }
    }

    public DisputaId getId() {
        return id;
    }

    public OtId getOtId() {
        return otId;
    }

    public String getMotivo() {
        return motivo;
    }

    public EstadoDisputa getEstado() {
        return estado;
    }

    public String getResolucion() {
        return resolucion;
    }

    public Instant getCreadaEn() {
        return creadaEn;
    }

    public Instant getResueltaEn() {
        return resueltaEn;
    }
}
