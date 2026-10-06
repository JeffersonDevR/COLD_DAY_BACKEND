package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import java.time.LocalDate;
import java.util.UUID;

import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "documento_proveedor", indexes = {
        @Index(name = "idx_documento_proveedor_proveedor_id", columnList = "proveedor_id")
})
@Getter
@Setter
@NoArgsConstructor
public class DocumentoProveedorJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "proveedor_id", nullable = false)
    private UUID proveedorId;

    @Column(nullable = false)
    private String tipo;

    @Column(name = "fecha_vencimiento")
    private LocalDate fechaVencimiento;

    public static DocumentoProveedorJpaEntity fromDomain(DocumentoProveedor documento) {
        DocumentoProveedorJpaEntity target = new DocumentoProveedorJpaEntity();
        target.id = documento.id();
        target.proveedorId = documento.proveedorId().valor();
        target.tipo = documento.tipo();
        target.fechaVencimiento = documento.fechaVencimiento();
        return target;
    }

    public DocumentoProveedor toDomain() {
        return new DocumentoProveedor(id, ProveedorId.desde(proveedorId), tipo, fechaVencimiento);
    }
}
