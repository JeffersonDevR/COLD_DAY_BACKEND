package com.sena.cold_day.core.modules.proveedores.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.proveedores.application.dto.ProveedorResponse;
import com.sena.cold_day.core.modules.proveedores.application.usecases.GestionarDocumentacionProveedorUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.ListarProveedoresUseCase;
import com.sena.cold_day.core.modules.proveedores.application.usecases.RegistrarProveedorUseCase;
import com.sena.cold_day.core.modules.proveedores.domain.entities.DocumentoProveedor;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests.DocumentoProveedorApiRequest;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests.ProveedorApiRequest;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.requests.ValidacionProveedorApiRequest;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses.DocumentoProveedorApiResponse;
import com.sena.cold_day.core.modules.proveedores.infrastructure.api.responses.ProveedorApiResponse;
import com.sena.cold_day.core.shared.infrastructure.security.AutorizacionPropietario;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

/**
 * Admin-only supplier surface plus the supplier's own documentation and
 * validation gate. Authorization is enforced server-side with
 * {@code @PreAuthorize}; no {@code permitAll} matcher is added for this path, so
 * an unauthenticated caller is rejected with 401 and a caller without the role
 * with 403 (D7). There is no public supplier registration surface.
 *
 * <p>{@link GestionarDocumentacionProveedorUseCase} existed with no HTTP surface,
 * which left every supplier permanently {@code PENDIENTE}: the aggregate gate
 * {@code exigirValidado()} was enforced on accepting, rejecting and delivering an
 * insumo, but nothing could ever move a supplier to {@code APROBADO}. These
 * endpoints are the missing half of that gate.
 */
@RestController
@RequestMapping("/api/proveedores")
public class ProveedorController {

    private final RegistrarProveedorUseCase registrar;
    private final ListarProveedoresUseCase listarProveedores;
    private final GestionarDocumentacionProveedorUseCase documentacion;
    private final AutorizacionPropietario autorizacion;

    @SuppressWarnings("java:S107") // Superficie REST cohesiva de /api/proveedores; dividir rompería la cohesión por recurso.
    public ProveedorController(RegistrarProveedorUseCase registrar, ListarProveedoresUseCase listarProveedores,
            GestionarDocumentacionProveedorUseCase documentacion, AutorizacionPropietario autorizacion) {
        this.registrar = registrar;
        this.listarProveedores = listarProveedores;
        this.documentacion = documentacion;
        this.autorizacion = autorizacion;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ResponseEntity<ProveedorApiResponse> crear(@Valid @RequestBody ProveedorApiRequest request) {
        ProveedorResponse created = registrar.registrar(request.toApplicationRequest());
        return ResponseEntity.created(URI.create("/api/proveedores/" + created.id()))
                .body(ProveedorApiResponse.from(created));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public List<ProveedorApiResponse> listar() {
        return listarProveedores.listar().stream().map(ProveedorApiResponse::from).toList();
    }

    /**
     * The authenticated supplier's own documents. The supplier profile is
     * resolved from the principal, never from the path or body, so this can only
     * ever expose the caller's own documentation.
     */
    @GetMapping("/me/documentos")
    @PreAuthorize("hasRole('PROVEEDOR')")
    public List<DocumentoProveedorApiResponse> misDocumentos(@AuthenticationPrincipal AuthenticatedUser principal) {
        return documentacion.listarDocumentos(principal.usuarioId()).stream()
                .map(DocumentoProveedorApiResponse::from).toList();
    }

    /**
     * Registers a document for the authenticated supplier. Documents are
     * metadata-only declarations: there is no file, no upload and no storage, so
     * the request carries only the type and the expiry date.
     */
    @PostMapping("/me/documentos")
    @PreAuthorize("hasRole('PROVEEDOR')")
    public ResponseEntity<DocumentoProveedorApiResponse> registrarDocumento(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody DocumentoProveedorApiRequest request) {
        DocumentoProveedor documento = documentacion.registrarDocumento(principal.usuarioId(), request.tipo(),
                request.fechaVencimiento());
        return ResponseEntity.created(URI.create("/api/proveedores/me/documentos"))
                .body(DocumentoProveedorApiResponse.from(documento));
    }

    /** One supplier's documents: read by an administrator to decide, or by the owner. */
    @GetMapping("/{id}/documentos")
    @PreAuthorize("hasAnyRole('PROVEEDOR','ADMINISTRADOR')")
    public List<DocumentoProveedorApiResponse> documentos(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable UUID id) {
        ProveedorId proveedorId = ProveedorId.desde(id);
        autorizacion.exigirProveedorOAdmin(principal, proveedorId);
        return documentacion.listarDocumentos(proveedorId).stream().map(DocumentoProveedorApiResponse::from).toList();
    }

    /**
     * The validation decision. Administrator only: whether a supplier's
     * documentation is sufficient is an operator judgement, never something a
     * supplier can decide about itself.
     */
    @PatchMapping("/{id}/validacion")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ResponseEntity<Void> validar(@PathVariable UUID id,
            @Valid @RequestBody ValidacionProveedorApiRequest request) {
        ProveedorId proveedorId = ProveedorId.desde(id);
        if (request.esAprobar()) {
            documentacion.aprobar(proveedorId);
        } else {
            documentacion.rechazar(proveedorId, request.motivo());
        }
        return ResponseEntity.noContent().build();
    }
}
