package com.sena.cold_day.core.modules.ot.domain.entities;

import java.time.Instant;

import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaOtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * First-class dispatch offer (design D4): one row per notified technician with
 * a server-authoritative expiry. It survives restarts and is pollable, so the
 * offer state — not the push transport — is authoritative (D6).
 */
public class OfertaOt {

    private OfertaOtId id;
    private OtId otId;
    private TecnicoId tecnicoId;
    private double radioKm;
    private OfertaEstado estado;
    private Instant creadaEn;
    private Instant expiraEn;
    private Instant resueltaEn;

    private OfertaOt() {
    }

    /** Creates a pending offer with a 60-second window (RF-F1-09). */
    public static OfertaOt crear(OtId otId, TecnicoId tecnicoId, double radioKm,
            Instant creadaEn, Instant expiraEn) {
        if (otId == null) {
            throw new IllegalArgumentException("La orden de trabajo es requerida");
        }
        if (tecnicoId == null) {
            throw new IllegalArgumentException("El tecnico es requerido");
        }
        if (radioKm <= 0) {
            throw new IllegalArgumentException("El radio debe ser positivo");
        }
        if (creadaEn == null) {
            throw new IllegalArgumentException("El momento de creacion es requerido");
        }
        if (expiraEn == null) {
            throw new IllegalArgumentException("El vencimiento de la oferta es requerido");
        }
        if (!expiraEn.isAfter(creadaEn)) {
            throw new IllegalArgumentException("El vencimiento debe ser posterior a la creacion");
        }

        OfertaOt oferta = new OfertaOt();
        oferta.id = OfertaOtId.nueva();
        oferta.otId = otId;
        oferta.tecnicoId = tecnicoId;
        oferta.radioKm = radioKm;
        oferta.estado = OfertaEstado.PENDIENTE;
        oferta.creadaEn = creadaEn;
        oferta.expiraEn = expiraEn;
        return oferta;
    }

    @SuppressWarnings("java:S107") // Rehidratacion de persistencia (8 campos, 1 sobre el umbral). Ver OfertaOtJpaEntity.toDomain para el mapeo 1:1.
    public static OfertaOt reconstituir(OfertaOtId id, OtId otId, TecnicoId tecnicoId, double radioKm,
            OfertaEstado estado, Instant creadaEn, Instant expiraEn, Instant resueltaEn) {
        OfertaOt oferta = new OfertaOt();
        oferta.id = id;
        oferta.otId = otId;
        oferta.tecnicoId = tecnicoId;
        oferta.radioKm = radioKm;
        oferta.estado = estado;
        oferta.creadaEn = creadaEn;
        oferta.expiraEn = expiraEn;
        oferta.resueltaEn = resueltaEn;
        return oferta;
    }

    /** An offer is actionable only while pending and strictly before its expiry. */
    public boolean estaVigente(Instant ahora) {
        return estado == OfertaEstado.PENDIENTE && expiraEn != null && ahora != null
                && ahora.isBefore(expiraEn);
    }

    /** Closes a pending offer whose window expired. */
    public void expirar(Instant ahora) {
        if (estado != OfertaEstado.PENDIENTE) {
            throw new IllegalStateException("Solo se puede expirar una oferta PENDIENTE, estado actual: " + estado);
        }
        this.estado = OfertaEstado.EXPIRADA;
        this.resueltaEn = ahora;
    }

    public OfertaOtId getId() {
        return id;
    }

    public OtId getOtId() {
        return otId;
    }

    public TecnicoId getTecnicoId() {
        return tecnicoId;
    }

    public double getRadioKm() {
        return radioKm;
    }

    public OfertaEstado getEstado() {
        return estado;
    }

    public Instant getCreadaEn() {
        return creadaEn;
    }

    public Instant getExpiraEn() {
        return expiraEn;
    }

    public Instant getResueltaEn() {
        return resueltaEn;
    }
}
