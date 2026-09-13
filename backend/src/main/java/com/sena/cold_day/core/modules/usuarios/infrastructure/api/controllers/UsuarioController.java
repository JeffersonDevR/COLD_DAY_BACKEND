package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import java.net.URI;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.usuarios.application.dto.TokenResponse;
import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioRequest;
import com.sena.cold_day.core.modules.usuarios.application.dto.UsuarioResponse;
import com.sena.cold_day.core.modules.usuarios.application.usecases.AutenticarUsuarioUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.RecuperarContrasenaUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.RegistrarUsuarioUseCase;
import com.sena.cold_day.core.modules.usuarios.application.usecases.RestablecerContrasenaUseCase;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.CredencialesApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.RecuperarContrasenaApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.RestablecerContrasenaApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.UsuarioApiRequest;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.responses.UsuarioApiResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final RegistrarUsuarioUseCase registrar;
    private final AutenticarUsuarioUseCase autenticar;
    private final RecuperarContrasenaUseCase recuperar;
    private final RestablecerContrasenaUseCase restablecer;

    public UsuarioController(RegistrarUsuarioUseCase registrar, AutenticarUsuarioUseCase autenticar,
            RecuperarContrasenaUseCase recuperar, RestablecerContrasenaUseCase restablecer) {
        this.registrar = registrar;
        this.autenticar = autenticar;
        this.recuperar = recuperar;
        this.restablecer = restablecer;
    }

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

    private UsuarioRequest toApplicationRequest(UsuarioApiRequest request) {
        return new UsuarioRequest(request.nombre(), request.correo(), request.password(),
                request.telefono(), request.fotoUrl(), request.rol(),
                Boolean.TRUE.equals(request.aceptaHabeasData()));
    }
}
