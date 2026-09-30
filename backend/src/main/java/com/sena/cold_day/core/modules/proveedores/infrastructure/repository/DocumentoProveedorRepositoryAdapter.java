package com.sena.cold_day.core.modules.proveedores.infrastructure.repository;

import java.util.List;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.DocumentoProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.DocumentoProveedorJpaEntity;
import com.sena.cold_day.core.modules.proveedores.infrastructure.persistence.SpringDataDocumentoProveedorRepository;

@Repository
public class DocumentoProveedorRepositoryAdapter implements DocumentoProveedorRepository {

    private final SpringDataDocumentoProveedorRepository repository;

    public DocumentoProveedorRepositoryAdapter(SpringDataDocumentoProveedorRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public DocumentoProveedor save(DocumentoProveedor documento) {
        return repository.saveAndFlush(DocumentoProveedorJpaEntity.fromDomain(documento)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentoProveedor> buscarPorProveedor(ProveedorId proveedorId) {
        return repository.findByProveedorIdOrderByIdAsc(proveedorId.valor()).stream()
                .map(DocumentoProveedorJpaEntity::toDomain)
                .toList();
    }
}
