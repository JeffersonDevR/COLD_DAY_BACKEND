package com.sena.cold_day.core.modules.proveedores.application.usecases;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.DocumentoProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

@Service
public class GestionarDocumentacionProveedorUseCase {

    private final ProveedorRepository proveedorRepository;
    private final DocumentoProveedorRepository documentoRepository;
    private final Clock clock;

    public GestionarDocumentacionProveedorUseCase(ProveedorRepository proveedorRepository,
            DocumentoProveedorRepository documentoRepository, Clock clock) {
        this.proveedorRepository = proveedorRepository;
        this.documentoRepository = documentoRepository;
        this.clock = clock;
    }

    @Transactional
    public DocumentoProveedor registrarDocumento(UsuarioId usuarioId, String tipo, LocalDate fechaVencimiento) {
        Proveedor proveedor = proveedorPorUsuario(usuarioId);
        return documentoRepository.save(new DocumentoProveedor(null, proveedor.getId(), tipo, fechaVencimiento));
    }

    @Transactional(readOnly = true)
    public List<DocumentoProveedor> listarDocumentos(UsuarioId usuarioId) {
        return documentoRepository.buscarPorProveedor(proveedorPorUsuario(usuarioId).getId());
    }

    @Transactional(readOnly = true)
    public List<DocumentoProveedor> listarDocumentos(ProveedorId proveedorId) {
        return documentoRepository.buscarPorProveedor(proveedorId);
    }

    @Transactional
    public void aprobar(ProveedorId proveedorId) {
        Proveedor proveedor = proveedorRepository.buscarPorId(proveedorId)
                .orElseThrow(() -> new IllegalArgumentException("Proveedor no encontrado"));
        // One read, one clock: the documents are the aggregate's input, and the
        // "at least one and all vigente" rule now lives in the aggregate.
        List<DocumentoProveedor> documentos = documentoRepository.buscarPorProveedor(proveedorId);
        proveedor.aprobarValidacion(LocalDate.now(clock), documentos);
        proveedorRepository.save(proveedor);
    }

    @Transactional
    public void rechazar(ProveedorId proveedorId, String motivo) {
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("El motivo del rechazo es requerido");
        }
        Proveedor proveedor = proveedorRepository.buscarPorId(proveedorId)
                .orElseThrow(() -> new IllegalArgumentException("Proveedor no encontrado"));
        proveedor.rechazarValidacion(motivo);
        proveedorRepository.save(proveedor);
    }

    private Proveedor proveedorPorUsuario(UsuarioId usuarioId) {
        return proveedorRepository.findByUsuarioId(usuarioId.valor())
                .orElseThrow(() -> new IllegalArgumentException("Perfil de proveedor no encontrado"));
    }
}
