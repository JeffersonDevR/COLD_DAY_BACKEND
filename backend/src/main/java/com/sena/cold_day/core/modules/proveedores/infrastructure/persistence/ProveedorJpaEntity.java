package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.shared.domain.Point;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Persistence mapping for the {@code proveedor} table (design schema). Own-UUID
 * identity: {@code proveedor.id} is its own UUID primary key and
 * {@code usuario_id} is a scalar unique foreign key to {@code usuario(id)},
 * mirroring {@code TecnicoJpaEntity}.
 */
@Entity
@Table(name = "proveedor")
@Getter
@Setter
@NoArgsConstructor
public class ProveedorJpaEntity {

    @Id
    private UUID id;

    @Column(name = "usuario_id", nullable = false, unique = true)
    private Long usuarioId;

    @Column(name = "razon_social", nullable = false)
    private String razonSocial;

    @Column(name = "nit", nullable = false, unique = true, length = 50)
    private String nit;

    @Column(name = "telefono", length = 30)
    private String telefono;

    @Column(name = "direccion", length = 500)
    private String direccion;

    @Column(name = "latitud")
    private Double latitud;

    @Column(name = "longitud")
    private Double longitud;

    @Convert(converter = CategoriasInsumoJsonConverter.class)
    @Column(name = "categorias_insumo", length = 1000)
    private Set<String> categoriasInsumo = new LinkedHashSet<>();

    @Column(nullable = false)
    private boolean activo = true;

    @Column(name = "creado_en")
    private Instant creadoEn;

    public static ProveedorJpaEntity fromDomain(Proveedor source) {
        ProveedorJpaEntity target = new ProveedorJpaEntity();
        target.id = source.getId() == null ? null : source.getId().valor();
        target.apply(source);
        return target;
    }

    /** Applies domain state into an existing managed row (merge semantics). */
    public void applyFromDomain(Proveedor source) {
        apply(source);
    }

    private void apply(Proveedor source) {
        this.usuarioId = source.getUsuarioId();
        this.razonSocial = source.getRazonSocial();
        this.nit = source.getNit();
        this.telefono = source.getTelefono();
        this.direccion = source.getDireccion();
        Point ubicacion = source.getUbicacion();
        this.latitud = ubicacion == null ? null : ubicacion.latitud();
        this.longitud = ubicacion == null ? null : ubicacion.longitud();
        this.categoriasInsumo = new LinkedHashSet<>(source.getCategoriasInsumo());
        this.activo = source.isActivo();
        this.creadoEn = source.getCreadoEn();
    }

    public Proveedor toDomain() {
        Point ubicacion = latitud == null || longitud == null ? null : new Point(latitud, longitud);
        return Proveedor.reconstituir(ProveedorId.desde(id), usuarioId, razonSocial, nit, telefono,
                direccion, ubicacion,
                categoriasInsumo == null ? new LinkedHashSet<>() : new LinkedHashSet<>(categoriasInsumo),
                activo, creadoEn);
    }
}
