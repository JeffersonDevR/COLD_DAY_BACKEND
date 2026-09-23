package com.sena.cold_day.core.modules.proveedores.domain.repository;

import java.util.List;
import java.util.Optional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

/**
 * Domain port for Proveedor persistence, implemented by the JPA adapter.
 * {@code findByActivoTrue} is the eligibility read used by dispatch: only
 * active suppliers may receive or act on requests (spec P5, design AD7).
 */
public interface ProveedorRepository {

    Proveedor save(Proveedor proveedor);

    /** Lists every supplier, including inactive ones (spec P4 admin listing). */
    List<Proveedor> findAll();

    Optional<Proveedor> buscarPorId(ProveedorId id);

    Optional<Proveedor> findByUsuarioId(Long usuarioId);

    List<Proveedor> findByActivoTrue();

    void deleteAll();
}
