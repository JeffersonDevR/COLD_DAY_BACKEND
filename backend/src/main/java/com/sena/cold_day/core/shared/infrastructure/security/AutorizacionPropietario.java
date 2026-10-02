package com.sena.cold_day.core.shared.infrastructure.security;

import java.util.Optional;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;

/**
 * Single place where "is this caller the owner of that resource?" is answered
 * from the authenticated {@link AuthenticatedUser}.
 * <p>
 * The principal always comes from the security context. A technician id supplied
 * in the path is only ever used to <em>look up</em> the owner, never to
 * impersonate one, so it cannot be used to act on someone else's resource.
 * <p>
 * Lives in {@code infrastructure} on purpose: authorization is a transport
 * concern, so the domain aggregates stay framework-free and keep validating
 * only business rules.
 */
@Component
public class AutorizacionPropietario {

    private final TecnicoRepository tecnicoRepository;
    private final ClienteRepository clienteRepository;

    public AutorizacionPropietario(TecnicoRepository tecnicoRepository, ClienteRepository clienteRepository) {
        this.tecnicoRepository = tecnicoRepository;
        this.clienteRepository = clienteRepository;
    }

    /** ADMINISTRADOR, or the technician identified by {@code tecnicoId} is the caller's. */
    public boolean esTecnicoOAdmin(AuthenticatedUser principal, TecnicoId tecnicoId) {
        if (principal.rol() == Rol.ADMINISTRADOR) {
            return true;
        }
        return esTecnicoDe(principal, tecnicoId);
    }

    /** True only when {@code tecnicoId} belongs to the authenticated user. */
    public boolean esTecnicoDe(AuthenticatedUser principal, TecnicoId tecnicoId) {
        return tecnicoRepository.findByIdAndActivoTrue(tecnicoId)
                .filter(tecnico -> tecnico.getUsuarioId().equals(principal.usuarioId().valor()))
                .isPresent();
    }

    /**
     * The active technician profile of the authenticated user, resolved from the
     * principal rather than from a caller-supplied id. Empty when the user has
     * no technician profile (a CLIENTE, for example).
     */
    public Optional<TecnicoId> tecnicoDelPrincipal(AuthenticatedUser principal) {
        return tecnicoRepository.findByUsuarioIdAndActivoTrue(principal.usuarioId().valor())
                .map(Tecnico::getId);
    }

    /** True when the caller is the technician that owns {@code tecnicoId}. */
    public boolean esPropietarioDe(AuthenticatedUser principal, TecnicoId tecnicoId) {
        return esTecnicoDe(principal, tecnicoId);
    }

    /** 403 unless the caller is the owning technician or an ADMINISTRADOR. */
    public void exigirTecnicoOAdmin(AuthenticatedUser principal, TecnicoId tecnicoId) {
        if (!esTecnicoOAdmin(principal, tecnicoId)) {
            throw new AccessDeniedException("El usuario autenticado no administra ese tecnico");
        }
    }

    /**
     * ADMINISTRADOR, the owning client, or the assigned technician. Used by the
     * read paths of an OT, including the one that exposes the technician's live
     * location.
     */
    public boolean esParticipanteOAdmin(AuthenticatedUser principal, OtResponse ot) {
        if (principal.rol() == Rol.ADMINISTRADOR) {
            return true;
        }
        if (clienteRepository.findByUsuarioId(principal.usuarioId())
                .filter(cliente -> cliente.getId().equals(ot.clienteId()))
                .isPresent()) {
            return true;
        }
        return ot.tecnicoId() != null
                && tecnicoRepository.findByUsuarioIdAndActivoTrue(principal.usuarioId().valor())
                        .filter(tecnico -> tecnico.getId().equals(ot.tecnicoId()))
                        .isPresent();
    }

    /** 403 unless the caller participates in the OT or is an ADMINISTRADOR. */
    public void exigirParticipanteOAdmin(AuthenticatedUser principal, OtResponse ot) {
        if (!esParticipanteOAdmin(principal, ot)) {
            throw new AccessDeniedException("El usuario autenticado no participa en la orden");
        }
    }
}
