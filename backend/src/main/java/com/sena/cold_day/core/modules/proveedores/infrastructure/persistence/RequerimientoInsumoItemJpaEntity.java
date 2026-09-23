package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import com.sena.cold_day.core.modules.proveedores.domain.entities.RequerimientoInsumoItem;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * JPA mapping of {@code requerimiento_insumo_item} (design schema): the immutable
 * free-text lines of a request. The owning {@code requerimiento_id} foreign key is
 * managed by the parent's {@code @OneToMany @JoinColumn} association, so this
 * entity stays a plain child row with its own generated id.
 */
@Entity
@Table(name = "requerimiento_insumo_item")
@Getter
@Setter
@NoArgsConstructor
public class RequerimientoInsumoItemJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "descripcion", nullable = false, length = 500)
    private String descripcion;

    @Column(name = "cantidad", nullable = false)
    private int cantidad;

    public static RequerimientoInsumoItemJpaEntity fromDomain(RequerimientoInsumoItem source) {
        RequerimientoInsumoItemJpaEntity target = new RequerimientoInsumoItemJpaEntity();
        target.id = source.getId();
        target.descripcion = source.getDescripcion();
        target.cantidad = source.getCantidad();
        return target;
    }

    public RequerimientoInsumoItem toDomain() {
        return RequerimientoInsumoItem.reconstituir(id, descripcion, cantidad);
    }
}
