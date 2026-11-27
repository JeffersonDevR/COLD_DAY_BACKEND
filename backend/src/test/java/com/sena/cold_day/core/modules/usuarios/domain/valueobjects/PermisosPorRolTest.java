package com.sena.cold_day.core.modules.usuarios.domain.valueobjects;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PermisosPorRolTest {

    @Test
    void cadaRolInternoTieneExactamenteSusPermisos() {
        assertThat(PermisosPorRol.de(Rol.ADMINISTRADOR)).containsExactlyInAnyOrder(Permiso.values());
        assertThat(PermisosPorRol.de(Rol.CONTABLE)).containsExactlyInAnyOrder(
                Permiso.VER_OPERACION, Permiso.GESTIONAR_CONSIGNACIONES, Permiso.VER_TECNICOS);
        assertThat(PermisosPorRol.de(Rol.RECURSOS_HUMANOS)).containsExactlyInAnyOrder(
                Permiso.VER_TECNICOS, Permiso.VALIDAR_DOCUMENTACION);
    }

    @Test
    void losRolesDeLaAppNoTienenPermisos() {
        assertThat(PermisosPorRol.de(Rol.CLIENTE)).isEmpty();
        assertThat(PermisosPorRol.de(Rol.TECNICO)).isEmpty();
        assertThat(PermisosPorRol.de(Rol.PROVEEDOR)).isEmpty();
    }

    @Test
    void soloSeGestionanLosRolesInternosQueNoSonAdministrador() {
        assertThat(PermisosPorRol.rolesGestionables())
                .containsExactlyInAnyOrder(Rol.CONTABLE, Rol.RECURSOS_HUMANOS);
    }
}
