package com.sena.cold_day.core.modules.usuarios.domain.valueobjects;

import java.util.EnumSet;
import java.util.Set;

/**
 * Único mapa rol → permisos del backend. Un rol interno nuevo es su nombre en
 * {@link Rol}, su línea aquí y una migración. La web repite este mapa en
 * {@code core/permisos.ts}: deben coincidir.
 */
public final class PermisosPorRol {

    private PermisosPorRol() {
    }

    public static Set<Permiso> de(Rol rol) {
        return switch (rol) {
            case ADMINISTRADOR -> EnumSet.allOf(Permiso.class);
            case CONTABLE -> EnumSet.of(Permiso.VER_OPERACION, Permiso.GESTIONAR_CONSIGNACIONES,
                    Permiso.VER_TECNICOS);
            case RECURSOS_HUMANOS -> EnumSet.of(Permiso.VER_TECNICOS, Permiso.VALIDAR_DOCUMENTACION);
            case CLIENTE, TECNICO, PROVEEDOR -> EnumSet.noneOf(Permiso.class);
        };
    }

    /** Roles que el administrador puede crear desde el panel. */
    public static Set<Rol> rolesGestionables() {
        Set<Rol> roles = EnumSet.noneOf(Rol.class);
        for (Rol rol : Rol.values()) {
            if (rol != Rol.ADMINISTRADOR && !de(rol).isEmpty()) {
                roles.add(rol);
            }
        }
        return roles;
    }
}
