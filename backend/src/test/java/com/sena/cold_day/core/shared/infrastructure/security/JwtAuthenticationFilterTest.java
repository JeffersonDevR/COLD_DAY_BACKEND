package com.sena.cold_day.core.shared.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.stream.Collectors;

import javax.crypto.SecretKey;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.expression.SecurityExpressionRoot;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * WS1 (R2/R3) at the authority layer: the filter grants exactly one
 * {@code ROLE_<r>} authority per role in the token's {@code roles} set, keeps
 * the legacy {@code rol}-only fallback, and never invents ADMINISTRADOR.
 *
 * <p>The gate outcomes are asserted through Spring Security's own
 * {@link SecurityExpressionRoot} — the exact engine behind
 * {@code @PreAuthorize("hasRole(...)")} — so "dual passes both gates" and "dual
 * never gains ADMINISTRADOR" are proven against real evaluation, not a
 * re-implementation of role matching.
 */
class JwtAuthenticationFilterTest {

    private static final String SECRET = "cold-day-test-secret-key-32-bytes-long!!";
    private static final JwtProperties PROPS = new JwtProperties(SECRET, 3_600_000);
    // Mockito returns Optional.empty() for the version lookup by default: the
    // token-version check is skipped (D7) and not under test here.
    private static final UsuarioRepository USUARIOS = mock(UsuarioRepository.class);

    private final JwtTokenIssuer issuer = new JwtTokenIssuer(PROPS);

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void dualRoleTokenGrantsExactlyOneAuthorityPerRole() throws Exception {
        String jwt = issuer.emitir(new UsuarioId(10L), Set.of(Rol.CLIENTE, Rol.TECNICO), Rol.CLIENTE, 0).valor();

        Authentication auth = authenticate(jwt);

        assertThat(authorities(auth)).containsExactlyInAnyOrder("ROLE_CLIENTE", "ROLE_TECNICO");
        assertThat(auth.getPrincipal()).isInstanceOf(AuthenticatedUser.class);
        AuthenticatedUser principal = (AuthenticatedUser) auth.getPrincipal();
        assertThat(principal.rol()).isEqualTo(Rol.CLIENTE);
        assertThat(principal.roles()).containsExactlyInAnyOrder(Rol.CLIENTE, Rol.TECNICO);
    }

    @Test
    void dualRolePrincipalPassesBothClienteAndTecnicoGatesButNeverAdministrador() throws Exception {
        String jwt = issuer.emitir(new UsuarioId(10L), Set.of(Rol.CLIENTE, Rol.TECNICO), Rol.CLIENTE, 0).valor();

        SecurityExpressionRoot<?> gates = gates(authenticate(jwt));

        assertThat(gates.hasRole("CLIENTE")).as("dual user passes the CLIENTE gate").isTrue();
        assertThat(gates.hasRole("TECNICO")).as("dual user passes the TECNICO gate").isTrue();
        assertThat(gates.hasRole("ADMINISTRADOR")).as("M3: derived capabilities never include ADMINISTRADOR").isFalse();
        assertThat(gates.hasRole("CONTABLE")).isFalse();
    }

    @Test
    void legacyTokenWithoutRolesClaimFallsBackToThePrimaryRole() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String legacy = Jwts.builder()
                .subject("5")
                .claim("rol", "TECNICO")
                .claim("ver", 0)
                .signWith(key)
                .compact();

        Authentication auth = authenticate(legacy);

        assertThat(authorities(auth)).containsExactly("ROLE_TECNICO");
        assertThat(((AuthenticatedUser) auth.getPrincipal()).roles()).containsExactly(Rol.TECNICO);
    }

    /**
     * Roadmap B3: the optional {@code nombre} claim rides into the principal
     * when the token carries it.
     */
    @Test
    void freshTokenSurfacesTheDisplayNameClaim() throws Exception {
        String jwt = issuer.emitir(new UsuarioId(11L), "Ana Perez", Set.of(Rol.CLIENTE), Rol.CLIENTE, 0).valor();

        Authentication auth = authenticate(jwt);

        assertThat(((AuthenticatedUser) auth.getPrincipal()).nombre()).isEqualTo("Ana Perez");
        assertThat(authorities(auth)).containsExactly("ROLE_CLIENTE");
    }

    /** Deterministic fallback: legacy tokens keep authenticating with an empty display name. */
    @Test
    void legacyTokenWithoutNombreClaimAuthenticatesWithAnEmptyDisplayName() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String legacy = Jwts.builder()
                .subject("5")
                .claim("rol", "CLIENTE")
                .claim("ver", 0)
                .signWith(key)
                .compact();

        Authentication auth = authenticate(legacy);

        assertThat(auth).isNotNull();
        assertThat(((AuthenticatedUser) auth.getPrincipal()).nombre()).isEmpty();
    }

    @Test
    void administradorPrimaryRoleStillGrantsTheAdminAuthority() throws Exception {
        String jwt = issuer.emitir(new UsuarioId(1L), Set.of(Rol.ADMINISTRADOR), Rol.ADMINISTRADOR, 0).valor();

        SecurityExpressionRoot<?> gates = gates(authenticate(jwt));

        assertThat(gates.hasRole("ADMINISTRADOR")).isTrue();
        assertThat(gates.hasRole("CLIENTE")).isFalse();
    }

    @Test
    void singleRoleTokenFailsTheGateItLacks() throws Exception {
        // A user whose only profile is CLIENTE (no active tecnico row): the derived
        // set is {CLIENTE}, so the TECNICO gate must still reject it.
        String jwt = issuer.emitir(new UsuarioId(5L), Set.of(Rol.CLIENTE), Rol.CLIENTE, 0).valor();

        SecurityExpressionRoot<?> gates = gates(authenticate(jwt));

        assertThat(gates.hasRole("CLIENTE")).isTrue();
        assertThat(gates.hasRole("TECNICO")).isFalse();
        assertThat(gates.hasRole("ADMINISTRADOR")).isFalse();
    }

    private Authentication authenticate(String jwt) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/ot");
        request.addHeader("Authorization", "Bearer " + jwt);
        new JwtAuthenticationFilter(PROPS, USUARIOS)
                .doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return SecurityContextHolder.getContext().getAuthentication();
    }

    private Set<String> authorities(Authentication auth) {
        return auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
    }

    private SecurityExpressionRoot<?> gates(Authentication auth) {
        return new SecurityExpressionRoot<Object>(auth) { };
    }
}
