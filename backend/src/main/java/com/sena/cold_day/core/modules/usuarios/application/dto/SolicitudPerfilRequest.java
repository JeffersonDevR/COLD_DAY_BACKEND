package com.sena.cold_day.core.modules.usuarios.application.dto;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/** Perfil deseado y motivacion declarados por el solicitante. */
public record SolicitudPerfilRequest(Rol perfilDeseado, String motivacion) {
}
