package com.sena.cold_day.core.modules.clientes.infrastructure.api.controllers;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.modules.clientes.application.dto.ClienteOnboardingRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteRequest;
import com.sena.cold_day.core.modules.clientes.application.dto.ClienteResponse;
import com.sena.cold_day.core.modules.clientes.application.usecases.RegistrarClienteUseCase;
import com.sena.cold_day.core.modules.clientes.infrastructure.api.requests.ClienteOnboardingApiRequest;
import com.sena.cold_day.core.modules.clientes.infrastructure.api.requests.ClientePerfilApiRequest;
import com.sena.cold_day.core.modules.clientes.infrastructure.api.responses.ClienteApiResponse;
import com.sena.cold_day.core.modules.geolocalizacion.application.usecases.ActualizarUbicacionClienteUseCase;
import com.sena.cold_day.core.modules.geolocalizacion.infrastructure.api.requests.UbicacionApiRequest;
import com.sena.cold_day.core.modules.ot.application.usecases.ListarOtUseCase;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtApiResponse;
import com.sena.cold_day.core.modules.usuarios.application.usecases.EmitirTokenDeSesionUseCase;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/clientes")
public class ClienteController {

    private final RegistrarClienteUseCase registrar;
    private final EmitirTokenDeSesionUseCase emitirToken;
    private final ActualizarUbicacionClienteUseCase actualizarUbicacion;
    private final ListarOtUseCase listarOts;

    public ClienteController(RegistrarClienteUseCase registrar, EmitirTokenDeSesionUseCase emitirToken,
            ActualizarUbicacionClienteUseCase actualizarUbicacion, ListarOtUseCase listarOts) {
        this.registrar = registrar;
        this.emitirToken = emitirToken;
        this.actualizarUbicacion = actualizarUbicacion;
        this.listarOts = listarOts;
    }

    /**
     * Alta pública de cliente: crea el Usuario (rol CLIENTE) y su perfil en una
     * sola transacción (mismo patrón que {@code POST /api/tecnicos}). Ya no
     * depende de un principal autenticado.
     */
    @PostMapping
    public ResponseEntity<ClienteApiResponse> crear(@Valid @RequestBody ClienteOnboardingApiRequest request) {
        ClienteResponse created = registrar.registrarNuevo(toApplicationRequest(request));
        return ResponseEntity.created(URI.create("/api/clientes/" + created.id().valor()))
                .body(ClienteApiResponse.from(created));
    }

    /**
     * Second-profile acquisition (WS2): an authenticated usuario adds a client
     * profile. The target usuario is the principal — never a path id or body
     * field — and the created role is CLIENTE by construction, never from the
     * body (M5). On success the principal's tokenVersion is bumped, so the
     * capability set only grows with a freshly issued token: the response carries
     * that replacement in the additive {@code token} field, which keeps the
     * caller signed in instead of forcing a re-login. A second attempt is
     * rejected with 409.
     */
    @PostMapping("/perfil")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteApiResponse> crearMiPerfil(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody ClientePerfilApiRequest request) {
        ClienteResponse created = registrar.registrar(
                new ClienteRequest(request.tipoCliente(), request.calle(), request.ciudad(), request.barrio(),
                        request.ubicacion()),
                principal.usuarioId());
        // The acquisition revoked the token in flight; hand back the replacement
        // minted by the same issuer the login path uses.
        String token = emitirToken.emitirPara(principal.usuarioId()).token();
        return ResponseEntity.created(URI.create("/api/clientes/" + created.id().valor()))
                .body(ClienteApiResponse.conToken(created, token));
    }

    /**
     * RF-F1-06: the authenticated client captures its own coordinates,
     * preserving the textual address. Resolved from the principal.
     */
    @PutMapping("/me/ubicacion")
    public ResponseEntity<Void> actualizarUbicacion(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody UbicacionApiRequest request) {
        actualizarUbicacion.actualizar(principal.usuarioId(), request.toPoint());
        return ResponseEntity.noContent().build();
    }

    /**
     * Lists the OTs of the authenticated client (RF-F1-25).
     * <p>
     * "My orders" is resolved entirely from the principal and scoped to that
     * usuario's client profile, so it is authenticated-only rather than
     * client-role-only: a dual-role usuario (TECNICO) without a client profile
     * must receive the business state "no client profile" (404 from
     * {@code ListarOtUseCase#listarPorCliente}) instead of a role rejection
     * (403), which is what the frontend renders as the missing-profile state.
     */
    @GetMapping("/me/ots")
    @PreAuthorize("isAuthenticated()")
    public List<OtApiResponse> misOts(@AuthenticationPrincipal AuthenticatedUser principal) {
        return listarOts.listarPorCliente(principal.usuarioId()).stream()
                .map(resumen -> OtApiResponse.from(resumen.ot(), resumen.clienteNombre(), resumen.tecnicoNombre()))
                .toList();
    }

    private ClienteOnboardingRequest toApplicationRequest(ClienteOnboardingApiRequest request) {
        return new ClienteOnboardingRequest(request.nombre(), request.correo(), request.password(),
                request.telefono(), request.fotoUrl(), request.tipoCliente(), request.calle(), request.ciudad(),
                request.barrio(), request.ubicacion(), request.aceptaHabeasData());
    }
}
