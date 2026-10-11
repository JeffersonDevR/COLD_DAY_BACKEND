package com.sena.cold_day.core.modules.usuarios.domain.services;

import java.util.Set;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * Option C: {@code usuario.rol} stays the primary/registration role, and the
 * CLIENTE/TECNICO/PROVEEDOR capabilities are DERIVED from profile-row existence.
 *
 * <p>The resolved set is {@code {rolPrimario}} unioned with every profile-derived
 * capability. It MUST NEVER derive ADMINISTRADOR or CONTABLE: those come solely
 * from {@code usuario.rol} (M3, least privilege). Deriving from persisted rows
 * — never from request input — is also what keeps the set free of privilege
 * escalation.
 */
public interface RolesDePerfilPort {

    /** primary rol UNION {CLIENTE if clientes row} UNION {TECNICO if tecnico row} UNION {PROVEEDOR if proveedor row}. */
    Set<Rol> resolver(UsuarioId usuarioId, Rol rolPrimario);
}
