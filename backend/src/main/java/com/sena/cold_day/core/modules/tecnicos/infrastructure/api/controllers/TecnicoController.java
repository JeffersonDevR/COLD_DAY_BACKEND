package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoRequest;
import com.sena.cold_day.core.modules.tecnicos.application.dto.TecnicoResponse;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.ActualizarTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.BuscarTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.CambiarDisponibilidadUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.EliminarTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.RegistrarTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.ValidarDocumentacionTecnicoUseCase;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests.DocumentoTecnicoApiRequest;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests.TecnicoApiRequest;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests.ValidacionTecnicoApiRequest;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses.DocumentoTecnicoApiResponse;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.api.responses.TecnicoApiResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/tecnicos")
public class TecnicoController {

    private final RegistrarTecnicoUseCase registrar;
    private final ActualizarTecnicoUseCase actualizar;
    private final BuscarTecnicoUseCase buscar;
    private final EliminarTecnicoUseCase eliminar;
    private final CambiarDisponibilidadUseCase cambiarDisponibilidad;
    private final ValidarDocumentacionTecnicoUseCase validarDocumentacion;

    public TecnicoController(RegistrarTecnicoUseCase registrar, ActualizarTecnicoUseCase actualizar,
            BuscarTecnicoUseCase buscar, EliminarTecnicoUseCase eliminar,
            CambiarDisponibilidadUseCase cambiarDisponibilidad,
            ValidarDocumentacionTecnicoUseCase validarDocumentacion) {
        this.registrar = registrar;
        this.actualizar = actualizar;
        this.buscar = buscar;
        this.eliminar = eliminar;
        this.cambiarDisponibilidad = cambiarDisponibilidad;
        this.validarDocumentacion = validarDocumentacion;
    }

    @PostMapping
    public ResponseEntity<TecnicoApiResponse> crear(@Valid @RequestBody TecnicoApiRequest request) {
        TecnicoResponse created = registrar.registrar(toApplicationRequest(request));
        return ResponseEntity.created(URI.create("/api/tecnicos/" + created.id()))
                .body(TecnicoApiResponse.from(created));
    }

    @GetMapping
    public List<TecnicoApiResponse> listar() {
        return buscar.listar().stream().map(TecnicoApiResponse::from).toList();
    }

    @GetMapping("/{id}")
    public TecnicoApiResponse obtener(@PathVariable TecnicoId id) {
        return TecnicoApiResponse.from(buscar.obtener(id));
    }

    @PutMapping("/{id}")
    public TecnicoApiResponse actualizar(@PathVariable TecnicoId id, @Valid @RequestBody TecnicoApiRequest request) {
        return TecnicoApiResponse.from(actualizar.actualizar(id, toApplicationRequest(request)));
    }

    @PutMapping("/{id}/estado")
    public TecnicoApiResponse cambiarEstado(@PathVariable TecnicoId id, @RequestBody java.util.Map<String, String> body) {
        com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo nuevo =
                com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo
                        .valueOf(body.getOrDefault("estadoOperativo", "FUERA_DE_SERVICIO"));
        cambiarDisponibilidad.cambiarEstado(id, nuevo);
        return obtener(id);
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
    public ResponseEntity<DocumentoTecnicoApiResponse> registrarDocumento(@PathVariable  TecnicoId id,
            @Valid @RequestBody DocumentoTecnicoApiRequest request) {
        var documento = validarDocumentacion.registrarDocumento(id, request.tipo(), request.fechaVencimiento());
        return ResponseEntity.created(URI.create("/api/tecnicos/" + id + "/documentos"))
                .body(DocumentoTecnicoApiResponse.from(documento));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable TecnicoId id) {
        eliminar.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    private TecnicoRequest toApplicationRequest(TecnicoApiRequest request) {
        return new TecnicoRequest(request.nombre(), request.correo(), request.password(), request.telefono(),
                request.numeroIdentificacion(), request.fotoUrl(), request.categoriasServicio(),
                request.certificaciones());
    }
}
