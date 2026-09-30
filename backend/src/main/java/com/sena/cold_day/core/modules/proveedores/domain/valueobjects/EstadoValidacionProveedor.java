package com.sena.cold_day.core.modules.proveedores.domain.valueobjects;

/**
 * Documentary validation lifecycle of a supplier (spec disp.R3, design AD7).
 * It is the supplier-side mirror of the {@code tecnicos}
 * {@code EstadoValidacion} cycle, sharing the same four literals and the same
 * transition shape declared in {@code TransicionesProveedor}.
 *
 * <p>Every state is retriable: a rejected or suspended supplier may resubmit and
 * be re-evaluated, and an approved one may be revoked, so none of them is
 * terminal. There is deliberately no {@code esTerminal()}: a query that always
 * returns {@code false} carries no decision. What dispatch actually needs is
 * {@link #estaAprobado()}.
 */
public enum EstadoValidacionProveedor {
    PENDIENTE, APROBADO, RECHAZADO, SUSPENDIDO;

    /**
     * Only an approved supplier may dispatch or deliver insumos (design AD7).
     * This is the single predicate behind {@code Proveedor.exigirValidado()}.
     */
    public boolean estaAprobado() {
        return this == APROBADO;
    }
}
