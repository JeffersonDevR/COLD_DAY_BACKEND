package com.sena.cold_day.modules.tecnicos.domain.entities;

import java.util.HashSet;
import java.util.Set;

import com.sena.cold_day.modules.tecnicos.domain.exception.TecnicoAsignadoException;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Technician profile (SRS RF-F1-03/04/05). Soft delete via {@code activo}:
 * active flag hides inactive rows from every query while the rows
 * stay retained for traceability (RNF-09).
 */
@Getter
@Setter
@NoArgsConstructor
public class Tecnico {

	private Long id;

	private String numeroIdentificacion;

	private String nombres;

	private String apellidos;

	private String telefono;

	private String email;

	private String fotoUrl;

	private Set<CategoriaServicio> categoriasServicio = new HashSet<>();

	private EstadoOperativo estadoOperativo;

	private Set<Certificacion> certificaciones = new HashSet<>();

	private boolean activo = true;

	public boolean EsActivo() {
		return this.activo;
	}

	public void setEstadoOperativo(EstadoOperativo nuevoEstadoOperativo) {
		if (this.estadoOperativo == EstadoOperativo.OCUPADO){
			throw new TecnicoAsignadoException(this.numeroIdentificacion);
		}
		this.estadoOperativo = nuevoEstadoOperativo;
	}
}
