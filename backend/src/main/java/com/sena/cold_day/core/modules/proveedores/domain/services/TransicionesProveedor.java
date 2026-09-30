package com.sena.cold_day.core.modules.proveedores.domain.services;

import java.util.Map;
import java.util.Set;

import com.sena.cold_day.core.modules.proveedores.domain.exception.TransicionValidacionProveedorInvalidaException;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoValidacionProveedor;

/**
 * Explicit supplier-validation transition table, mirroring
 * {@link TransicionesRequerimiento} in the same module and the
 * {@code tecnico.estado_validacion} cycle it is a mirror of. Every row names
 * its trigger and actor.
 *
 * <pre>
 * Transition                    Trigger                          Actor
 * -&gt; PENDIENTE                 supplier registers              SISTEMA
 * PENDIENTE  -&gt; APROBADO       all documents vigente           ADMINISTRADOR
 * PENDIENTE  -&gt; RECHAZADO      documents rejected              ADMINISTRADOR
 * RECHAZADO  -&gt; APROBADO       supplier resubmits, re-reviewed ADMINISTRADOR
 * RECHAZADO  -&gt; RECHAZADO      rejected again after resubmit   ADMINISTRADOR
 * APROBADO   -&gt; SUSPENDIDO     a document expired unrenewed    SISTEMA
 * APROBADO   -&gt; RECHAZADO      revocation after approval       ADMINISTRADOR
 * SUSPENDIDO -&gt; APROBADO       document renewed and reviewed   ADMINISTRADOR
 * SUSPENDIDO -&gt; RECHAZADO      renewal refused                 ADMINISTRADOR
 * </pre>
 *
 * <p>{@code SUSPENDIDO} has no producing method yet: unlike
 * {@code tecnicos}, this module ships no documentary-vigency sweep for
 * suppliers, so nothing can drive an expiry. The edge
 * {@code APROBADO -&gt; SUSPENDIDO} is declared anyway so the state is not
 * unreachable by construction — a future sweep only has to add the aggregate
 * method, not rewrite the table. No state is terminal: every one of the four
 * can leave, because a rejected or suspended supplier may resubmit and be
 * re-evaluated, and an approved one may be revoked.
 */
public final class TransicionesProveedor {

    private static final Map<EstadoValidacionProveedor, Set<EstadoValidacionProveedor>> PERMITIDAS = Map.of(
            EstadoValidacionProveedor.PENDIENTE,
            Set.of(EstadoValidacionProveedor.APROBADO, EstadoValidacionProveedor.RECHAZADO),
            EstadoValidacionProveedor.RECHAZADO,
            Set.of(EstadoValidacionProveedor.APROBADO, EstadoValidacionProveedor.RECHAZADO),
            EstadoValidacionProveedor.APROBADO,
            Set.of(EstadoValidacionProveedor.SUSPENDIDO, EstadoValidacionProveedor.RECHAZADO),
            EstadoValidacionProveedor.SUSPENDIDO,
            Set.of(EstadoValidacionProveedor.APROBADO, EstadoValidacionProveedor.RECHAZADO));

    private TransicionesProveedor() {
    }

    /**
     * Validates a transition against the table; illegal transitions raise
     * {@link TransicionValidacionProveedorInvalidaException}.
     */
    public static void validar(EstadoValidacionProveedor origen, EstadoValidacionProveedor destino) {
        if (origen == null || destino == null) {
            throw new IllegalArgumentException("Los estados de origen y destino son requeridos");
        }
        if (!esPermitida(origen, destino)) {
            throw new TransicionValidacionProveedorInvalidaException(origen, destino);
        }
    }

    public static boolean esPermitida(EstadoValidacionProveedor origen, EstadoValidacionProveedor destino) {
        if (origen == null || destino == null) {
            return false;
        }
        return PERMITIDAS.getOrDefault(origen, Set.of()).contains(destino);
    }
}
