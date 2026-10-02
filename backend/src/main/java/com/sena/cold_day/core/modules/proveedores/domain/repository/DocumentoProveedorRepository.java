package com.sena.cold_day.core.modules.proveedores.domain.repository;

import java.util.List;

import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;

public interface DocumentoProveedorRepository {
    DocumentoProveedor save(DocumentoProveedor documento);
    List<DocumentoProveedor> buscarPorProveedor(ProveedorId proveedorId);
}
