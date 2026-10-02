package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.ActualizarTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.BuscarTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.CambiarDisponibilidadUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.EliminarTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.ListarDocumentosTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.RegistrarTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.ValidarDocumentacionTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests.DocumentoTecnicoApiRequest;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests.EstadoOperativoApiRequest;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests.TecnicoApiRequest;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests.ValidacionTecnicoApiRequest;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses.DocumentoTecnicoApiResponse;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses.TecnicoApiResponse;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses.TecnicoCercanoApiResponse;
import com.sena.cold_day.core.modules.administracion.application.usecases.ListarLiquidacionesTecnicoUseCase;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.responses.LiquidacionApiResponse;
import com.sena.cold_day.core.modules.ot.application.usecases.ListarOtUseCase;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtApiResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.geolocalizacion.application.usecases.ActualizarUbicacionTecnicoUseCase;
import com.sena.cold_day.core.modules.geolocalizacion.application.usecases.BuscarTecnicosCercanosUseCase;
import com.sena.cold_day.core.modules.geolocalizacion.infrastructure.api.requests.UbicacionApiRequest;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.security.AutorizacionPropietario;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

@RestController
@RequestMapping("/api/tecnicos")
public class TecnicoController {

    private final RegistrarTecnicoUseCase registrar;
    private final ActualizarTecnicoUseCase actualizar;
    private final BuscarTecnicoUseCase buscar;
    private final EliminarTecnicoUseCase eliminar;
    private final CambiarDisponibilidadUseCase cambiarDisponibilidad;
    private final ValidarDocumentacionTecnicoUseCase validarDocumentacion;
    private final ActualizarUbicacionTecnicoUseCase actualizarUbicacion;
    private final BuscarTecnicosCercanosUseCase buscarCercanos;
    private final ListarOtUseCase listarOts;
    private final ListarLiquidacionesTecnicoUseCase listarLiquidaciones;
    private final ListarDocumentosTecnicoUseCase listarDocumentos;
    private final AutorizacionPropietario autorizacion;

    @SuppressWarnings("java:S107") // Superficie REST cohesiva de /api/tecnicos; dividir rompería la cohesión por recurso.
    public TecnicoController(RegistrarTecnicoUseCase registrar, ActualizarTecnicoUseCase actualizar,
            BuscarTecnicoUseCase buscar, EliminarTecnicoUseCase eliminar,
            CambiarDisponibilidadUseCase cambiarDisponibilidad,
            ValidarDocumentacionTecnicoUseCase validarDocumentacion,
            ActualizarUbicacionTecnicoUseCase actualizarUbicacion,
            BuscarTecnicosCercanosUseCase buscarCercanos, ListarOtUseCase listarOts,
            ListarLiquidacionesTecnicoUseCase listarLiquidaciones,
            ListarDocumentosTecnicoUseCase listarDocumentos,
            AutorizacionPropietario autorizacion) {
        this.registrar = registrar;
        this.actualizar = actualizar;
        this.buscar = buscar;
        this.eliminar = eliminar;
        this.cambiarDisponibilidad = cambiarDisponibilidad;
        this.validarDocumentacion = validarDocumentacion;
        this.actualizarUbicacion = actualizarUbicacion;
        this.buscarCercanos = buscarCercanos;
        this.listarOts = listarOts;
        this.listarLiquidaciones = listarLiquidaciones;
        this.listarDocumentos = listarDocumentos;
        this.autorizacion = autorizacion;
    }

    @PostMapping
    public ResponseEntity<TecnicoApiResponse> crear(@Valid @RequestBody TecnicoApiRequest request) {
        TecnicoResponse created = registrar.registrar(toApplicationRequest(request));
        return ResponseEntity.created(URI.create("/api/tecnicos/" + created.id()))
                .body(TecnicoApiResponse.from(created));
    }

    /** The full roster exposes every technician's contact data: administrators only. */
    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public List<TecnicoApiResponse> listar() {
        return buscar.listar().stream().map(TecnicoApiResponse::from).toList();
    }

    /** RF-F1-04: técnicos disponibles dentro de un radio desde un punto (radar del cliente). */
    @GetMapping("/cercanos")
    @PreAuthorize("hasAnyRole('CLIENTE','TECNICO')")
    public List<TecnicoCercanoApiResponse> cercanos(
            @RequestParam @DecimalMin("-90.0") @DecimalMax("90.0") double lat,
            @RequestParam @DecimalMin("-180.0") @DecimalMax("180.0") double lng,
            @RequestParam(defaultValue = "10.0") @DecimalMin("0.1") @DecimalMax("100.0") double radioKm,
            @RequestParam(required = false) CategoriaServicio categoria) {
        Set<CategoriaServicio> categorias = categoria == null ? Set.of() : Set.of(categoria);
        return buscarCercanos.buscar(new Point(lat, lng), radioKm, categorias).stream()
                .map(TecnicoCercanoApiResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public TecnicoApiResponse obtener(@PathVariable TecnicoId id) {
        return TecnicoApiResponse.from(buscar.obtener(id));
    }

    /** Editing a profile is restricted to its owner; an administrator may correct any of them. */
    @PutMapping("/{id}")
    public TecnicoApiResponse actualizar(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable TecnicoId id, @Valid @RequestBody TecnicoApiRequest request) {
        autorizacion.exigirTecnicoOAdmin(principal, id);
        return TecnicoApiResponse.from(actualizar.actualizar(id, toApplicationRequest(request)));
    }

    /**
     * The technician is resolved from the authenticated principal, not from the
     * path: there is no {@code {id}} to tamper with, so this endpoint can only
     * ever change the caller's own operational state. Restricted to the owner on
     * purpose — letting an administrator take a technician out of service would
     * silently remove capacity from the dispatch pool.
     * <p>
     * FRONTEND-VISIBLE PATH CHANGE: this was {@code PUT /api/tecnicos/{id}/estado}
     * and is now {@code PUT /api/tecnicos/me/estado}.
     */
    @PutMapping("/me/estado")
    public TecnicoApiResponse cambiarEstado(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody EstadoOperativoApiRequest request) {
        TecnicoId id = tecnicoDelPrincipal(principal);
        if (!autorizacion.esPropietarioDe(principal, id)) {
            throw new AccessDeniedException("Solo el tecnico propietario puede cambiar su estado operativo");
        }
        cambiarDisponibilidad.cambiarEstado(id, request.estadoOperativo());
        return TecnicoApiResponse.from(buscar.obtener(id));
    }

    /**
     * RF-F1-06: the authenticated technician captures its own coordinates. The
     * profile is resolved from the principal (no id in the path or body).
     */
    @PutMapping("/me/ubicacion")
    public ResponseEntity<Void> actualizarUbicacion(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody UbicacionApiRequest request) {
        actualizarUbicacion.actualizar(principal.usuarioId(), request.toPoint());
        return ResponseEntity.noContent().build();
    }

    /** Lists the OTs assigned to the authenticated technician. */
    @GetMapping("/me/ots")
    @PreAuthorize("hasRole('TECNICO')")
    public List<OtApiResponse> misOts(@AuthenticationPrincipal AuthenticatedUser principal) {
        return listarOts.listarPorTecnico(principal.usuarioId()).stream()
                .map(resumen -> OtApiResponse.from(resumen.ot(), resumen.clienteNombre(), resumen.tecnicoNombre()))
                .toList();
    }

    /** Lists the liquidaciones of the authenticated technician. */
    @GetMapping("/me/liquidaciones")
    @PreAuthorize("hasRole('TECNICO')")
    public List<LiquidacionApiResponse> misLiquidaciones(@AuthenticationPrincipal AuthenticatedUser principal) {
        return listarLiquidaciones.listar(principal.usuarioId()).stream()
                .map(LiquidacionApiResponse::from).toList();
    }

    /** Lists the documentos of the authenticated technician. */
    @GetMapping("/me/documentos")
    @PreAuthorize("hasRole('TECNICO')")
    public List<DocumentoTecnicoApiResponse> misDocumentos(@AuthenticationPrincipal AuthenticatedUser principal) {
        return listarDocumentos.listar(principal.usuarioId()).stream()
                .map(DocumentoTecnicoApiResponse::from).toList();
    }

    /**
     * CU-03: administrator validation gate. Authorization by rol
     * ADMINISTRADOR is infrastructure responsibility (Spring Security);
     * the aggregate never validates "who" calls — only TecnicoNoValidado
     * (business rule) can still raise a second, distinct 403.
     */
    @PatchMapping("/{id}/validacion")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMINISTRADOR')")
    public ResponseEntity<Void> validar(@PathVariable TecnicoId id,
            @Valid @RequestBody ValidacionTecnicoApiRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal
            com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser admin) {
        if (request.esAprobar()) {
            validarDocumentacion.aprobar(id);
        } else {
            validarDocumentacion.rechazar(id, request.motivo());
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/documentos")
    public ResponseEntity<DocumentoTecnicoApiResponse> registrarDocumento(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable TecnicoId id, @Valid @RequestBody DocumentoTecnicoApiRequest request) {
        autorizacion.exigirTecnicoOAdmin(principal, id);
        var documento = validarDocumentacion.registrarDocumento(id, request.tipo(), request.fechaVencimiento());
        return ResponseEntity.created(URI.create("/api/tecnicos/" + id + "/documentos"))
                .body(DocumentoTecnicoApiResponse.from(documento));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ResponseEntity<Void> eliminar(@PathVariable TecnicoId id) {
        eliminar.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    /** Resolves the technician profile of the authenticated user. */
    private TecnicoId tecnicoDelPrincipal(AuthenticatedUser principal) {
        return autorizacion.tecnicoDelPrincipal(principal)
                .orElseThrow(() -> new AccessDeniedException(
                        "El usuario autenticado no tiene un perfil de tecnico activo"));
    }

    private TecnicoRequest toApplicationRequest(TecnicoApiRequest request) {
        return new TecnicoRequest(request.nombre(), request.correo(), request.password(), request.telefono(),
                request.numeroIdentificacion(), request.fotoUrl(), request.categoriasServicio(),
                request.certificaciones(), Boolean.TRUE.equals(request.aceptaHabeasData()));
    }
}
