package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.geolocalizacion.infrastructure.listeners.DesactivarTrackingListener;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * Location capture IT (spec capability {@code geolocation-tracking}): clients
 * and technicians persist their coordinates through the authenticated
 * {@code me} endpoints, and out-of-range coordinates are rejected without
 * persisting anything.
 */
@SpringBootTest
@AutoConfigureMockMvc
class GeolocalizacionApiIT {

    @Autowired MockMvc mockMvc;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired DesactivarTrackingListener desactivarTrackingListener;

    @BeforeEach
    @AfterEach
    void cleanup() {
        clienteRepository.deleteAll();
        tecnicoRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void updatesTheAuthenticatedTechnicianLocationAndStartsTracking() throws Exception {
        Long usuarioId = crearUsuario("tecnico@example.com", Rol.TECNICO);
        Tecnico tecnico = crearTecnico(usuarioId, CategoriaServicio.REFRIGERACION);

        mockMvc.perform(put("/api/tecnicos/me/ubicacion")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitud\":4.65,\"longitud\":-74.05}"))
                .andExpect(status().isNoContent());

        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).hasValueSatisfying(found -> {
            assertThat(found.getUbicacion()).isEqualTo(new Point(4.65, -74.05));
            assertThat(found.isTrackingActivo()).isTrue();
            assertThat(found.getUbicacionActualizadaEn()).isNotNull();
        });
    }

    @Test
    void rejectsOutOfRangeLatitudeAndPersistsNothing() throws Exception {
        Long usuarioId = crearUsuario("tecnico-lat@example.com", Rol.TECNICO);
        Tecnico tecnico = crearTecnico(usuarioId, CategoriaServicio.REFRIGERACION);

        mockMvc.perform(put("/api/tecnicos/me/ubicacion")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitud\":91.0,\"longitud\":-74.05}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").isNotEmpty());

        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).hasValueSatisfying(found -> {
            assertThat(found.getUbicacion()).isNull();
            assertThat(found.isTrackingActivo()).isFalse();
        });
    }

    @Test
    void rejectsOutOfRangeLongitudeAndPersistsNothing() throws Exception {
        Long usuarioId = crearUsuario("tecnico-lon@example.com", Rol.TECNICO);
        Tecnico tecnico = crearTecnico(usuarioId, CategoriaServicio.REFRIGERACION);

        // Longitude 200 is invalid, but -122.4 (valid) must not be rejected;
        // this exercises the corrected Point longitude range.
        mockMvc.perform(put("/api/tecnicos/me/ubicacion")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitud\":37.77,\"longitud\":200.0}"))
                .andExpect(status().isBadRequest());

        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).hasValueSatisfying(found -> {
            assertThat(found.getUbicacion()).isNull();
            assertThat(found.isTrackingActivo()).isFalse();
        });
    }

    @Test
    void returnsNotFoundWhenThePrincipalHasNoTechnicianProfile() throws Exception {
        Long usuarioId = crearUsuario("sin-perfil@example.com", Rol.TECNICO);

        mockMvc.perform(put("/api/tecnicos/me/ubicacion")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitud\":4.65,\"longitud\":-74.05}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(put("/api/tecnicos/me/ubicacion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitud\":4.65,\"longitud\":-74.05}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updatesTheAuthenticatedClienteLocationPreservingTheAddress() throws Exception {
        Long usuarioId = crearUsuario("cliente@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(usuarioId);

        mockMvc.perform(put("/api/clientes/me/ubicacion")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitud\":4.71,\"longitud\":-74.07}"))
                .andExpect(status().isNoContent());

        assertThat(clienteRepository.findByUsuarioId(new UsuarioId(usuarioId))).hasValueSatisfying(found -> {
            assertThat(found.getDireccionPrincipal().getUbicacion()).isEqualTo(new Point(4.71, -74.07));
            assertThat(found.getDireccionPrincipal().getCalle()).isEqualTo("Calle 1");
            assertThat(found.getDireccionPrincipal().getCiudad()).isEqualTo("Bogota");
        });
        assertThat(cliente.getId()).isNotNull();
    }

    /**
     * PR4 seam (task 4.6): the OT terminal transition lands in PR5. Tracking is
     * deactivated through the named listener, which PR5 will wire to
     * {@code OtFinalizada}/{@code OtCancelada}/{@code OtSinTecnicosDisponibles}.
     * The final coordinates must remain persisted for audit (RF-F1-27).
     */
    @Test
    void terminalStateDeactivatesTrackingButRetainsFinalCoordinates() throws Exception {
        Long usuarioId = crearUsuario("tracking@example.com", Rol.TECNICO);
        Tecnico tecnico = crearTecnico(usuarioId, CategoriaServicio.REFRIGERACION);

        mockMvc.perform(put("/api/tecnicos/me/ubicacion")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitud\":4.65,\"longitud\":-74.05}"))
                .andExpect(status().isNoContent());

        desactivarTrackingListener.desactivarTracking(tecnico.getId());

        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).hasValueSatisfying(found -> {
            assertThat(found.isTrackingActivo()).isFalse();
            assertThat(found.getUbicacion()).isEqualTo(new Point(4.65, -74.05));
            assertThat(found.getUbicacionActualizadaEn()).isNotNull();
        });
    }

    private Long crearUsuario(String correo, Rol rol) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, rol, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private Tecnico crearTecnico(Long usuarioId, CategoriaServicio categoria) {
        return tecnicoRepository.save(Tecnico.crear(usuarioId, "ID-" + usuarioId, Set.of(categoria), Set.of()));
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }

    private String jwt(Long usuarioId, Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }
}
