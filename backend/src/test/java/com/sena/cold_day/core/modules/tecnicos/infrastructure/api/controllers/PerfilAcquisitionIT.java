package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;

import javax.crypto.SecretKey;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.shared.infrastructure.security.JwtProperties;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import tools.jackson.databind.ObjectMapper;

/**
 * Second-profile acquisition IT (spec capability
 * {@code second-profile-acquisition}): both endpoints are bound to the
 * authenticated principal, the created role comes only from the profile type
 * (M5), a duplicate is rejected with 409, and the principal's token version is
 * bumped so the new capability is honored by the token the response hands back.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PerfilAcquisitionIT {

    @Autowired MockMvc mockMvc;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired JwtProperties jwtProperties;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void cleanup() {
        tecnicoRepository.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void acquiresTecnicoProfileForThePrincipalAndBumpsTokenVersion() throws Exception {
        long usuarioId = registrarClientePublico("dual-tec@example.com");
        String token = jwt(usuarioId, Rol.CLIENTE, 0);

        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-1\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuarioId").value(usuarioId))
                .andExpect(jsonPath("$.estadoValidacion").value("PENDIENTE"))
                .andExpect(jsonPath("$.numeroIdentificacion").value("T-1"));

        assertThat(tecnicoRepository.findByUsuarioId(usuarioId)).isPresent();
        assertThat(usuarioRepository.findByCorreo("dual-tec@example.com").orElseThrow().getTokenVersion()).isEqualTo(1);

        // The pre-acquisition token is revoked; the caller must use the replacement
        // returned by the acquisition instead of signing in again.
        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-1b\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsDuplicateTecnicoProfileWith409() throws Exception {
        long usuarioId = registrarClientePublico("dual-tec-dup@example.com");
        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-2\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE, 1))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-2b\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void ignoresRoleInBodyWhenAcquiringTecnicoProfile() throws Exception {
        long usuarioId = registrarClientePublico("dual-tec-m5@example.com");

        mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-3\",\"categoriasServicio\":[\"REFRIGERACION\"],"
                                + "\"rol\":\"ADMINISTRADOR\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estadoValidacion").value("PENDIENTE"));

        // The body role is dropped: the usuario keeps its registration role and
        // the created profile is the technician one, never an administrator.
        assertThat(usuarioRepository.findByCorreo("dual-tec-m5@example.com").orElseThrow().getRol())
                .isEqualTo(Rol.CLIENTE);
        assertThat(tecnicoRepository.findByUsuarioId(usuarioId)).isPresent();
    }

    @Test
    void acquiresClienteProfileForThePrincipalAndBumpsTokenVersion() throws Exception {
        long usuarioId = registrarTecnicoPublico("dual-cli@example.com");
        String token = jwt(usuarioId, Rol.TECNICO, 0);

        mockMvc.perform(post("/api/clientes/perfil").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuarioId").value(usuarioId))
                .andExpect(jsonPath("$.tipoCliente").value("B2C"));

        assertThat(clienteRepository.findByUsuarioId(new UsuarioId(usuarioId))).isPresent();
        assertThat(usuarioRepository.findByCorreo("dual-cli@example.com").orElseThrow().getTokenVersion()).isEqualTo(1);
    }

    /**
     * D2 (dual-role-cliente-ot): the acquisition bumps tokenVersion, so the
     * caller's token dies mid-session. The response now carries the replacement —
     * same issuer, capability set and display name as a login — so the client
     * keeps working without a forced re-login.
     */
    @Test
    void clienteProfileReturnsAFreshTokenThatKeepsTheSessionAlive() throws Exception {
        long usuarioId = registrarTecnicoPublico("dual-token-cli@example.com");
        String revocado = jwt(usuarioId, Rol.TECNICO, 0);

        String body = mockMvc.perform(post("/api/clientes/perfil").header("Authorization", "Bearer " + revocado)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isCreated())
                // The pre-existing payload is untouched: only "token" is additive.
                .andExpect(jsonPath("$.usuarioId").value(usuarioId))
                .andExpect(jsonPath("$.tipoCliente").value("B2C"))
                .andExpect(jsonPath("$.direccion.calle").value("Calle 1"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        String renovado = objectMapper.readTree(body).get("token").asString();
        Claims claims = claims(renovado);
        assertThat(claims.get("roles", List.class)).as("the freshly acquired capability travels in the token")
                .contains(Rol.CLIENTE.name());
        assertThat(claims.get("ver", Integer.class)).as("post-bump version, not the revoked one").isEqualTo(1);
        assertThat(claims.get("nombre", String.class)).isEqualTo("Ana");

        // The replacement authenticates a follow-up request as a CLIENTE...
        mockMvc.perform(get("/api/clientes/me/ots").header("Authorization", "Bearer " + renovado))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // ...while the token that was in flight stays revoked (ver bump).
        mockMvc.perform(get("/api/clientes/me/ots").header("Authorization", "Bearer " + revocado))
                .andExpect(status().isUnauthorized());
    }

    /**
     * D2b: acquiring the technician profile has the same revocation shape, so it
     * returns the replacement token the same way.
     */
    @Test
    void tecnicoProfileReturnsAFreshTokenThatKeepsTheSessionAlive() throws Exception {
        long usuarioId = registrarClientePublico("dual-token-tec@example.com");
        String revocado = jwt(usuarioId, Rol.CLIENTE, 0);

        String body = mockMvc.perform(post("/api/tecnicos/perfil").header("Authorization", "Bearer " + revocado)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-9\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuarioId").value(usuarioId))
                .andExpect(jsonPath("$.numeroIdentificacion").value("T-9"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        String renovado = objectMapper.readTree(body).get("token").asString();
        Claims claims = claims(renovado);
        assertThat(claims.get("roles", List.class)).contains(Rol.TECNICO.name());
        assertThat(claims.get("ver", Integer.class)).isEqualTo(1);
        assertThat(claims.get("nombre", String.class)).isEqualTo("Ana");

        mockMvc.perform(get("/api/tecnicos/me").header("Authorization", "Bearer " + renovado))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usuarioId").value(usuarioId))
                // A plain read never mints a session: the additive field stays
                // scoped to the acquisition response instead of spreading as null.
                .andExpect(jsonPath("$.token").doesNotExist());

        mockMvc.perform(get("/api/tecnicos/me").header("Authorization", "Bearer " + revocado))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsDuplicateClienteProfileWith409() throws Exception {
        long usuarioId = registrarTecnicoPublico("dual-cli-dup@example.com");
        mockMvc.perform(post("/api/clientes/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO, 0))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/clientes/perfil").header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO, 1))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 2\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void requiresAuthenticationForBothEndpoints() throws Exception {
        mockMvc.perform(post("/api/tecnicos/perfil").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numeroIdentificacion\":\"T-4\",\"categoriasServicio\":[\"REFRIGERACION\"]}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/clientes/perfil").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\"}"))
                .andExpect(status().isUnauthorized());
    }

    private long registrarClientePublico(String correo) throws Exception {
        String body = mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON)
                        .content(("{\"nombre\":\"Ana\",\"correo\":\"%s\",\"password\":\"secreto\","
                                + "\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\","
                                + "\"aceptaHabeasData\":true}").formatted(correo)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("usuarioId").asLong();
    }

    private long registrarTecnicoPublico(String correo) throws Exception {
        String body = mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON)
                        .content(("{\"numeroIdentificacion\":\"P-1\",\"nombre\":\"Ana\",\"correo\":\"%s\","
                                + "\"password\":\"secreto\",\"categoriasServicio\":[\"REFRIGERACION\"],"
                                + "\"aceptaHabeasData\":true}").formatted(correo)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("usuarioId").asLong();
    }

    private String jwt(long usuarioId, Rol rol, int tokenVersion) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, tokenVersion).valor();
    }

    private Claims claims(String jwt) {
        SecretKey key = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(jwt).getPayload();
    }
}
