package com.sena.cold_day.core.modules.usuarios.domain.valueobjects;

/**
 * Lo que se puede hacer en el panel interno. Las rutas compartidas piden uno de
 * estos, nunca una lista de roles; quién lo tiene lo dice {@link PermisosPorRol}.
 */
public enum Permiso {
    VER_OPERACION,
    GESTIONAR_CONSIGNACIONES,
    VER_TECNICOS,
    VALIDAR_DOCUMENTACION,
    GESTIONAR_DISPUTAS,
    GESTIONAR_CUENTAS
}
