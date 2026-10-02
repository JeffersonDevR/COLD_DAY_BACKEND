package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.usuarios.application.dto.TokenResponse;
import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioRequest;
import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioResponse;
import com.sena.cold_day.core.modules.usuarios.application.usecases.AutenticarUsuarioUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.ListarUsuariosUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.RecuperarContrasenaUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.RegistrarUsuarioUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.RestablecerContrasenaUseCase;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.CredencialesApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.RecuperarContrasenaApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.RestablecerContrasenaApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.UsuarioApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.responses.UsuarioApiResponse;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final RegistrarUsuarioUseCase registrar;
    private final AutenticarUsuarioUseCase autenticar;
    private final RecuperarContrasenaUseCase recuperar;
    private final RestablecerContrasenaUseCase restablecer;
    private final ListarUsuariosUseCase listarUsuarios;

    public UsuarioController(RegistrarUsuarioUseCase registrar, AutenticarUsuarioUseCase autenticar,
            RecuperarContrasenaUseCase recuperar, RestablecerContrasenaUseCase restablecer,
            ListarUsuariosUseCase listarUsuarios) {
        this.registrar = registrar;
        this.autenticar = autenticar;
        this.recuperar = recuperar;
        this.restablecer = restablecer;
        this.listarUsuarios = listarUsuarios;
    }

    /** Lista todos los usuarios del sistema (solo ADMINISTRADOR). */
    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public List<UsuarioApiResponse> listar() {
        return listarUsuarios.listar().stream().map(UsuarioApiResponse::from).toList();
    }

    /**
     * Legacy generic registration entry point, kept only so existing clients do
     * not break.
     *
     * @deprecated This endpoint predates the modularisation of the system into
     *             {@code /api/clientes}, {@code /api/tecnicos}, etc., and it is
     *             {@code permitAll}, so it cannot be the way to choose a role:
     *             the role is no longer accepted from the client and the server
     *             always assigns the least-privilege role {@link Rol#CLIENTE}.
     *             Use {@code POST /api/clientes} or {@code POST /api/tecnicos}
     *             for the intended flow.
     */
    @Deprecated(forRemoval = true)
    @PostMapping
    public ResponseEntity<UsuarioApiResponse> crear(@Valid @RequestBody UsuarioApiRequest request) {
        UsuarioResponse response = registrar.registrar(toApplicationRequest(request));
        return ResponseEntity.created(URI.create("/api/usuarios/" + response.id()))
                .body(UsuarioApiResponse.from(response));
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody CredencialesApiRequest request) {
        return autenticar.autenticar(request.correo(), request.password());
    }

    @PostMapping("/recuperar-contrasena")
    public ResponseEntity<Void> recuperarContrasena(@Valid @RequestBody RecuperarContrasenaApiRequest request) {
        recuperar.solicitar(request.correo());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/reset-contrasena")
    public ResponseEntity<Void> restablecerContrasena(@Valid @RequestBody RestablecerContrasenaApiRequest request) {
        restablecer.restablecer(request.token(), request.nuevaPassword());
        return ResponseEntity.noContent().build();
    }

    /**
     * The role is assigned by the server, never taken from the request: this is
     * a {@code permitAll} endpoint, so accepting a client-supplied role would
     * allow self-registering as {@code ADMINISTRADOR}. Least privilege applies.
     */
    private UsuarioRequest toApplicationRequest(UsuarioApiRequest request) {
        return new UsuarioRequest(request.nombre(), request.correo(), request.password(),
                request.telefono(), request.fotoUrl(), Rol.CLIENTE,
                Boolean.TRUE.equals(request.aceptaHabeasData()));
    }
}
