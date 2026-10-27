package com.sena.cold_day.core.modules.usuarios.application.dto;

import java.util.List;

/** 
 * Snapshot of "who is calling" for the Ionic app (roadmap B3). The display
 * name, correo, rol and derived roles always come from the persisted aggregate
 * — never from the optional {@code nombre} JWT claim, which is only a
 * convenience cached in the principal.
 */
public record MiPerfilResponse(
        Long id,
        String nombre,
        String correo,
        String rol,
        List<String> roles,
        String clientePerfilId,
        String tecnicoPerfilId,
        String proveedorPerfilId) {
}
