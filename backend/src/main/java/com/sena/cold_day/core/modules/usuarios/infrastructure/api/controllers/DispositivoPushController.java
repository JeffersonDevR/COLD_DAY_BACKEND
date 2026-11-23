package com.sena.cold_day.core.modules.usuarios.infrastructure.api.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.usuarios.application.usecases.GestionarDispositivoPushUseCase;
import com.sena.cold_day.core.modules.usuarios.infrastructure.api.requests.DispositivoPushApiRequest;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

/** Registro del token push del dispositivo del usuario autenticado. */
@RestController
public class DispositivoPushController {

    private final GestionarDispositivoPushUseCase dispositivos;

    public DispositivoPushController(GestionarDispositivoPushUseCase dispositivos) {
        this.dispositivos = dispositivos;
    }

    @PostMapping("/api/usuarios/me/dispositivos")
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void registrar(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody DispositivoPushApiRequest request) {
        String plataforma = request.plataforma() == null ? "ANDROID" : request.plataforma();
        dispositivos.registrar(principal.usuarioId(), request.token(), plataforma);
    }

    @DeleteMapping("/api/usuarios/me/dispositivos")
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void darDeBaja(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody DispositivoPushApiRequest request) {
        dispositivos.darDeBaja(principal.usuarioId(), request.token());
    }
}
