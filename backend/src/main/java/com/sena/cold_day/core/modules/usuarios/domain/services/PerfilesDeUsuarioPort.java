package com.sena.cold_day.core.modules.usuarios.domain.services;

import java.util.Optional;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Port for the profile-row lookups of {@code GET /api/usuarios/me} (roadmap B3).
 * It answers exactly the question the dual-profile mobile app asks after 
 * login: "which of my cliente/tecnico/proveedor profiles already exist?".
 *
 * <p>Derived from persisted rows — same source of truth and same read
 * semantics as {@link RolesDePerfilPort}: technician capability is
 * ACTIVE-only, cliente and proveedor existence is an unmapped read. The ids
 * are wire-safe scalars (string form of the domain id value objects) or empty.
 */
public interface PerfilesDeUsuarioPort {

    /** Wire-safe scalar ids of the profiles owned by the usuario (empty when absent). */
    record PerfilesDeUsuario(
            Optional<String> clientePerfilId,
            Optional<String> tecnicoPerfilId,
            Optional<String> proveedorPerfilId) {

    }

    PerfilesDeUsuario resolver(UsuarioId usuarioId);
}
