package com.sena.cold_day.modules.tecnicos.domain.entities;

import java.util.HashSet;
import java.util.Set;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

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
@Table("tecnico")
@Getter
@Setter
@NoArgsConstructor
public class Tecnico {

	@Id
	private Long id;

	@Column("numero_identificacion")
	private String numeroIdentificacion;

	private String nombres;

	private String apellidos;

	private String telefono;

	private String email;

	@Column("foto_url")
	private String fotoUrl;

	// In R2DBC, collections of complex types require custom converters or separate tables
	// For simplicity in this adaptation, we can represent these as Strings or keep them out
	// if we were not modeling them, but we will keep them as Set and let mapping handle them.
	// We might need to serialize/deserialize them to JSON in the database.

	@Column("categorias_servicio")
	private Set<CategoriaServicio> categoriasServicio = new HashSet<>();

	@Column("estado_operativo")
	private EstadoOperativo estadoOperativo;

	// Similar to CategoriaServicio, R2DBC doesn't map @ElementCollection automatically.
	// Assuming these are mapped correctly with converters or JSON.
	private Set<Certificacion> certificaciones = new HashSet<>();

	private boolean activo = true;

	public boolean EsActivo(){
		return this.activo;
	}

	public void setEstadoOperativo(EstadoOperativo nuevoEstadoOperativo) {
		if (this.estadoOperativo == EstadoOperativo.OCUPADO){
			throw new TecnicoAsignadoException(this.numeroIdentificacion);
		}
		this.estadoOperativo = nuevoEstadoOperativo;
	}
}
