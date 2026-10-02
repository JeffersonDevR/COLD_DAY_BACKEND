package com.sena.cold_day.core.shared.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

/**
 * Fast, Docker-free unit coverage of the {@code "system"} sentinel contract
 * (spec R5): every no-principal write path must resolve the auditor to the
 * literal {@code "system"} instead of {@code null}, and must not throw.
 *
 * <p>No Spring context is started on purpose — {@link AuditoriaConfig} only
 * reads {@link SecurityContextHolder} and needs no container, so this whole file
 * runs without a database.
 */
class AuditorAwareTest {

    private final AuditorAware<String> auditorAware = new AuditoriaConfig().auditorAware();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private String resolve() {
        return auditorAware.getCurrentAuditor().orElse(null);
    }

    @Test
    void resolvesTheAuthenticatedUserIdAsString() {
        install(new AuthenticatedUser(new UsuarioId(42L), Rol.TECNICO));

        assertThat(resolve()).isEqualTo("42");
    }

    @Test
    void resolvesEveryRolTheSameWayBecauseOnlyTheIdIsStored() {
        install(new AuthenticatedUser(new UsuarioId(7L), Rol.ADMINISTRADOR));
        assertThat(resolve()).isEqualTo("7");

        install(new AuthenticatedUser(new UsuarioId(7L), Rol.CLIENTE));
        assertThat(resolve()).isEqualTo("7");

        install(new AuthenticatedUser(new UsuarioId(7L), Rol.PROVEEDOR));
        assertThat(resolve()).isEqualTo("7");
    }

    @Test
    void fallsBackToSystemWithAnEmptySecurityContext() {
        assertThat(resolve()).isEqualTo("system");
    }

    @Test
    void fallsBackToSystemWhenAuthenticationIsNull() {
        // A context that exists but carries no authentication, as a cleared
        // context does once a filter chain has touched it.
        SecurityContextHolder.getContext().setAuthentication(null);

        assertThat(resolve()).isEqualTo("system");
    }

    @Test
    void fallsBackToSystemWhenThePrincipalIsNull() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(null, null, AuthorityUtils.NO_AUTHORITIES));

        assertThat(resolve()).isEqualTo("system");
    }

    @Test
    void fallsBackToSystemForTheAnonymousStringPrincipal() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("anonymousUser", null, AuthorityUtils.NO_AUTHORITIES));

        assertThat(resolve()).isEqualTo("system");
    }

    @Test
    void fallsBackToSystemForAPrincipalOfAnotherType() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new Object(), null, AuthorityUtils.NO_AUTHORITIES));

        assertThat(resolve()).isEqualTo("system");
    }

    @Test
    void neverReturnsNull() {
        install(new AuthenticatedUser(new UsuarioId(9L), Rol.CLIENTE));
        assertThat(auditorAware.getCurrentAuditor()).isPresent();

        SecurityContextHolder.clearContext();
        assertThat(auditorAware.getCurrentAuditor()).isPresent();
    }

    @Test
    void neverThrowsEvenWhenTheContextMisbehaves() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new Object(), null, AuthorityUtils.NO_AUTHORITIES));

        assertThatCode(this::resolve).doesNotThrowAnyException();
    }

    @Test
    void theSentinelConstantMatchesTheStoredValue() {
        assertThat(AuditoriaConfig.AUDITOR_SYSTEM).isEqualTo("system");
    }

    private void install(AuthenticatedUser principal) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal, null, AuthorityUtils.NO_AUTHORITIES));
    }
}
