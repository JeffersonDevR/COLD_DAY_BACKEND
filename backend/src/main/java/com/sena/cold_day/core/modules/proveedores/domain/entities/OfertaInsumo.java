package com.sena.cold_day.core.modules.proveedores.domain.entities;

import java.time.Instant;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * First-class dispatch offer for an insumo request (design AD6/AD7): one row per
 * notified active supplier with a server-authoritative expiry. It mirrors the OT
 * {@code OfertaOt} engine: the persisted offer state — not the push transport —
 * is authoritative, so it survives restarts and is pollable.
 */
public class OfertaInsumo {

    private OfertaInsumoId id;
    private RequerimientoInsumoId requerimientoId;
    private ProveedorId proveedorId;
    private OfertaInsumoEstado estado;
    private Instant creadaEn;
    private Instant expiraEn;
    private Instant resueltaEn;

    private OfertaInsumo() {
    }

    /** Creates a pending offer with the broadcast window. */
    public static OfertaInsumo crear(RequerimientoInsumoId requerimientoId, ProveedorId proveedorId,
            Instant creadaEn, Instant expiraEn) {
        if (requerimientoId == null) {
            throw new IllegalArgumentException("El requerimiento es requerido");
        }
        if (proveedorId == null) {
            throw new IllegalArgumentException("El proveedor es requerido");
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

        OfertaInsumo oferta = new OfertaInsumo();
        oferta.id = OfertaInsumoId.nueva();
        oferta.requerimientoId = requerimientoId;
        oferta.proveedorId = proveedorId;
        oferta.estado = OfertaInsumoEstado.PENDIENTE;
        oferta.creadaEn = creadaEn;
        oferta.expiraEn = expiraEn;
        return oferta;
    }

    /** Reconstitution from persistence: restores the full offer state. */
    public static OfertaInsumo reconstituir(OfertaInsumoId id, RequerimientoInsumoId requerimientoId,
            ProveedorId proveedorId, OfertaInsumoEstado estado, Instant creadaEn, Instant expiraEn,
            Instant resueltaEn) {
        OfertaInsumo oferta = new OfertaInsumo();
        oferta.id = id;
        oferta.requerimientoId = requerimientoId;
        oferta.proveedorId = proveedorId;
        oferta.estado = estado;
        oferta.creadaEn = creadaEn;
        oferta.expiraEn = expiraEn;
        oferta.resueltaEn = resueltaEn;
        return oferta;
    }

    /** An offer is actionable only while pending and strictly before its expiry. */
    public boolean estaVigente(Instant ahora) {
        return estado == OfertaInsumoEstado.PENDIENTE && expiraEn != null && ahora != null
                && ahora.isBefore(expiraEn);
    }

    /** First conditional accept wins (trigger: atomic accept gate, actor: PROVEEDOR). */
    public void aceptar(Instant ahora) {
        resolver(OfertaInsumoEstado.ACEPTADA, ahora);
    }

    /** Explicit decline by the holder (trigger: decline, actor: PROVEEDOR). */
    public void rechazar(Instant ahora) {
        resolver(OfertaInsumoEstado.RECHAZADO, ahora);
    }

    /** Sweeper or late-accept closure (trigger: expiry, actor: SISTEMA). */
    public void expirar(Instant ahora) {
        resolver(OfertaInsumoEstado.EXPIRADA, ahora);
    }

    /** Sibling invalidation after another offer won (trigger: sibling won, actor: SISTEMA). */
    public void cancelar(Instant ahora) {
        resolver(OfertaInsumoEstado.CANCELADA, ahora);
    }

    private void resolver(OfertaInsumoEstado destino, Instant ahora) {
        if (estado != OfertaInsumoEstado.PENDIENTE) {
            throw new IllegalStateException(
                    "Solo se puede resolver una oferta PENDIENTE, estado actual: " + estado);
        }
        this.estado = destino;
        this.resueltaEn = ahora;
    }

    public OfertaInsumoId getId() {
        return id;
    }

    public RequerimientoInsumoId getRequerimientoId() {
        return requerimientoId;
    }

    public ProveedorId getProveedorId() {
        return proveedorId;
    }

    public OfertaInsumoEstado getEstado() {
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
