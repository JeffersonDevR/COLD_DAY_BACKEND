package com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence;

import com.sena.cold_day.core.modules.tecnicos.domain.entities.DocumentoTecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "documento_tecnico")
@Getter
@Setter
@NoArgsConstructor
public class DocumentoTecnicoJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tecnico_id", nullable = false)
    private UUID tecnicoId;

    @Column(nullable = false)
    private String tipo;

    @Column(name = "fecha_vencimiento")
    private java.time.LocalDate fechaVencimiento;

    public static DocumentoTecnicoJpaEntity fromDomain(DocumentoTecnico documento) {
        DocumentoTecnicoJpaEntity target = new DocumentoTecnicoJpaEntity();
        target.id = documento.getId();
        target.tecnicoId = documento.getTecnicoId().valor();
        target.tipo = documento.getTipo();
        target.fechaVencimiento = documento.getFechaVencimiento();
        return target;
    }

    public DocumentoTecnico toDomain() {
        return new DocumentoTecnico(id, TecnicoId.desde(tecnicoId), tipo, fechaVencimiento);
    }
}
