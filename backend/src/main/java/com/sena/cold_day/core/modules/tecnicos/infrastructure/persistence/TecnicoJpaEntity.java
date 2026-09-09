package com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence;

import java.util.HashSet;
import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tecnico")
@Getter
@Setter
@NoArgsConstructor
public class TecnicoJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "numero_identificacion", nullable = false, unique = true)
    private String numeroIdentificacion;

    @Column(nullable = false)
    private String nombres;

    @Column(nullable = false)
    private String apellidos;

    private String telefono;
    private String email;

    @Column(name = "foto_url")
    private String fotoUrl;

    @Convert(converter = CategoriaServicioJsonConverter.class)
    @Column(name = "categorias_servicio", length = 4000)
    private Set<CategoriaServicio> categoriasServicio = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_operativo")
    private EstadoOperativo estadoOperativo;

    @Convert(converter = CertificacionJsonConverter.class)
    @Column(name = "certificaciones", length = 4000)
    private Set<Certificacion> certificaciones = new HashSet<>();

    @Column(nullable = false)
    private boolean activo = true;

    public static TecnicoJpaEntity fromDomain(Tecnico source) {
        TecnicoJpaEntity target = new TecnicoJpaEntity();
        target.id = source.getId();
        target.numeroIdentificacion = source.getNumeroIdentificacion();
        target.nombres = source.getNombres();
        target.apellidos = source.getApellidos();
        target.telefono = source.getTelefono();
        target.email = source.getEmail();
        target.fotoUrl = source.getFotoUrl();
        target.categoriasServicio = new HashSet<>(source.getCategoriasServicio());
        target.estadoOperativo = source.getEstadoOperativo();
        target.certificaciones = new HashSet<>(source.getCertificaciones());
        target.activo = source.isActivo();
        return target;
    }

    public Tecnico toDomain() {
        return Tecnico.reconstituir(id, numeroIdentificacion, nombres, apellidos, telefono, email, fotoUrl,
                categoriasServicio == null ? new HashSet<>() : new HashSet<>(categoriasServicio), estadoOperativo,
                certificaciones == null ? new HashSet<>() : new HashSet<>(certificaciones), activo);
    }
}
