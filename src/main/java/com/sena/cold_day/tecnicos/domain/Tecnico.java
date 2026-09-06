package com.sena.cold_day.tecnicos.domain;

import java.util.HashSet;
import java.util.Set;

import org.hibernate.annotations.SQLRestriction;

import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Technician profile (SRS RF-F1-03/04/05). Soft delete via {@code activo}:
 * the SQL restriction hides inactive rows from every query while the rows
 * stay retained for traceability (RNF-09).
 */
@Entity
@SQLRestriction("activo = true")
@Getter
@Setter
@NoArgsConstructor
public class Tecnico {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true)
	private String numeroIdentificacion;

	@Column(nullable = false)
	private String nombres;

	@Column(nullable = false)
	private String apellidos;

	private String telefono;

	private String email;

	private String fotoUrl;

	@ElementCollection(fetch = FetchType.EAGER)
	@Enumerated(EnumType.STRING)
	private Set<CategoriaServicio> categoriasServicio = new HashSet<>();

	@Enumerated(EnumType.STRING)
	private EstadoOperativo estadoOperativo;

	@ElementCollection(fetch = FetchType.EAGER)
	private Set<Certificacion> certificaciones = new HashSet<>();

	@Column(nullable = false)
	private boolean activo = true;
}
