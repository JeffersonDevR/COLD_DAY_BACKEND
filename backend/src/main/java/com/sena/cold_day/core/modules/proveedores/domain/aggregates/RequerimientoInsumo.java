package com.sena.cold_day.core.modules.proveedores.domain.aggregates;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.entities.RequerimientoInsumoItem;
import com.sena.cold_day.core.modules.proveedores.domain.services.TransicionesRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * Root aggregate of an insumo request raised from a technician's diagnóstico
 * (spec disp.R1, design AD5/AD6). It is a separate root from the OT: it never
 * blocks or mutates the OT lifecycle (spec disp.R6).
 *
 * <p>The OT and the technician are modelled locally as {@code UUID} references
 * so this bounded context never imports {@code ot}/{@code tecnicos} domain types.
 * Lines are free-text: there is no catalog and no {@code Insumo} entity.
 */
public class RequerimientoInsumo {

    private RequerimientoInsumoId id;
    private UUID otId;
    private UUID tecnicoId;
    private EstadoRequerimiento estado;
    private String observaciones;
    private List<RequerimientoInsumoItem> items = new ArrayList<>();
    private Instant creadaEn;
    private Instant expiraEn;
    private Instant resueltaEn;

    private RequerimientoInsumo() {
    }

    /**
     * Creates a request as {@code SOLICITADO} with a server-authoritative expiry
     * (trigger: diagnóstico with insumos, actor: assigned TECNICO). At least one
     * line is required: zero insumos create no request (spec disp.R1).
     */
    public static RequerimientoInsumo crear(UUID otId, UUID tecnicoId, List<InsumoLinea> lineas,
            String observaciones, Instant creadaEn, Instant expiraEn) {
        if (otId == null) {
            throw new IllegalArgumentException("La orden de trabajo es requerida");
        }
        if (tecnicoId == null) {
            throw new IllegalArgumentException("El tecnico es requerido");
        }
        if (lineas == null || lineas.isEmpty()) {
            throw new IllegalArgumentException("El requerimiento requiere al menos un insumo");
        }
        if (creadaEn == null) {
            throw new IllegalArgumentException("El momento de creacion es requerido");
        }
        if (expiraEn == null) {
            throw new IllegalArgumentException("El vencimiento del requerimiento es requerido");
        }
        if (!expiraEn.isAfter(creadaEn)) {
            throw new IllegalArgumentException("El vencimiento debe ser posterior a la creacion");
        }

        RequerimientoInsumo requerimiento = new RequerimientoInsumo();
        requerimiento.id = RequerimientoInsumoId.nueva();
        requerimiento.otId = otId;
        requerimiento.tecnicoId = tecnicoId;
        requerimiento.estado = EstadoRequerimiento.SOLICITADO;
        requerimiento.observaciones = observaciones;
        requerimiento.items = new ArrayList<>();
        for (InsumoLinea linea : lineas) {
            requerimiento.items.add(RequerimientoInsumoItem.crear(linea));
        }
        requerimiento.creadaEn = creadaEn;
        requerimiento.expiraEn = expiraEn;
        return requerimiento;
    }

    /** Reconstitution from persistence: restores the full aggregate state. */
    @SuppressWarnings("java:S107") // Rehidratacion de persistencia: requiere el estado completo del agregado. Un objeto parametro ocultaria el mapeo con RequerimientoInsumoJpaEntity.
    public static RequerimientoInsumo reconstituir(RequerimientoInsumoId id, UUID otId, UUID tecnicoId,
            EstadoRequerimiento estado, String observaciones, List<RequerimientoInsumoItem> items,
            Instant creadaEn, Instant expiraEn, Instant resueltaEn) {
        RequerimientoInsumo requerimiento = new RequerimientoInsumo();
        requerimiento.id = id;
        requerimiento.otId = otId;
        requerimiento.tecnicoId = tecnicoId;
        requerimiento.estado = estado;
        requerimiento.observaciones = observaciones;
        requerimiento.items = items == null ? new ArrayList<>() : new ArrayList<>(items);
        requerimiento.creadaEn = creadaEn;
        requerimiento.expiraEn = expiraEn;
        requerimiento.resueltaEn = resueltaEn;
        return requerimiento;
    }

    /** Atomic first-accept gate (trigger: atomic gate, actor: PROVEEDOR). */
    public void asignar(Instant ahora) {
        TransicionesRequerimiento.validar(estado, EstadoRequerimiento.ASIGNADO);
        this.estado = EstadoRequerimiento.ASIGNADO;
    }

    /** Delivery confirmed at the technician's location (actor: PROVEEDOR). */
    public void marcarEntregado(Instant ahora) {
        resolver(EstadoRequerimiento.ENTREGADO, ahora);
    }

    /** Broadcast found zero eligible suppliers (actor: SISTEMA). */
    public void marcarSinProveedor(Instant ahora) {
        resolver(EstadoRequerimiento.SIN_PROVEEDOR, ahora);
    }

    /** True while the request is open and strictly before its expiry. */
    public boolean estaVigente(Instant ahora) {
        return estado == EstadoRequerimiento.SOLICITADO && expiraEn != null && ahora != null
                && ahora.isBefore(expiraEn);
    }

    public boolean esTerminal() {
        return estado != null && estado.esTerminal();
    }

    private void resolver(EstadoRequerimiento destino, Instant ahora) {
        TransicionesRequerimiento.validar(estado, destino);
        this.estado = destino;
        this.resueltaEn = ahora;
    }

    public RequerimientoInsumoId getId() {
        return id;
    }

    public UUID getOtId() {
        return otId;
    }

    public UUID getTecnicoId() {
        return tecnicoId;
    }

    public EstadoRequerimiento getEstado() {
        return estado;
    }

    public String getObservaciones() {
        return observaciones;
    }

    public List<RequerimientoInsumoItem> getItems() {
        return Collections.unmodifiableList(items);
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
