package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

/**
 * The principal carries the primary {@code rol} (display/back-compat) plus the
 * expanded {@code roles} set. {@code tieneRol} is the single membership query the
 * admin checks use, so it must reflect exactly the set — never more.
 */
class AuthenticatedUserTest {

    @Test
    void tieneRolIsTrueOnlyForRolesInTheSet() {
        var principal = new AuthenticatedUser(new UsuarioId(1L), Rol.CLIENTE,
                Set.of(Rol.CLIENTE, Rol.TECNICO));

        assertThat(principal.tieneRol(Rol.CLIENTE)).isTrue();
        assertThat(principal.tieneRol(Rol.TECNICO)).isTrue();
        assertThat(principal.tieneRol(Rol.ADMINISTRADOR)).isFalse();
        assertThat(principal.tieneRol(Rol.CONTABLE)).isFalse();
    }

    @Test
    void twoArgConstructorDefaultsRolesToThePrimaryRole() {
        var principal = new AuthenticatedUser(new UsuarioId(2L), Rol.TECNICO);

        assertThat(principal.roles()).containsExactly(Rol.TECNICO);
        assertThat(principal.tieneRol(Rol.TECNICO)).isTrue();
        assertThat(principal.tieneRol(Rol.CLIENTE)).isFalse();
    }

    @Test
    void nullRolesFallBackToThePrimaryRole() {
        var principal = new AuthenticatedUser(new UsuarioId(3L), Rol.CLIENTE, null);

        assertThat(principal.roles()).containsExactly(Rol.CLIENTE);
    }
}
