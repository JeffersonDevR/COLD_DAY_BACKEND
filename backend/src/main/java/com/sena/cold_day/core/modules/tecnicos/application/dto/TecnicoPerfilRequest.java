package com.sena.cold_day.core.modules.tecnicos.application.dto;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

/**
 * Second-profile acquisition body for an already authenticated usuario. It
 * deliberately carries only profile data: the target usuario comes from the
 * principal and the role comes from the endpoint, never from the request (M5).
 */
public record TecnicoPerfilRequest(
        String numeroIdentificacion,
        Set<CategoriaServicio> categoriasServicio,
        Set<Certificacion> certificaciones) {
}
