package com.sena.cold_day.core.modules.proveedores.domain.exception;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoValidacionProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

/**
 * Thrown when a supplier tries to dispatch or deliver an insumo while its
 * documentation is not approved (spec disp.R3, design AD7). It mirrors the
 * {@code tecnicos} {@code TecnicoNoValidadoException} and closes the
 * authorization hole where eligibility was only {@code activo}. Mapped to 403
 * by the controller advices.
 */
public class ProveedorNoValidadoException extends RuntimeException {

    public ProveedorNoValidadoException(ProveedorId id, EstadoValidacionProveedor estadoActual) {
        super("El proveedor %s no puede despachar insumos: validacion documental en estado %s"
                .formatted(id, estadoActual));
    }
}
